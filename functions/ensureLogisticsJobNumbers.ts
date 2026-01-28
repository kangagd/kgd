import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Inline utility functions with '#' prefix support
const PURPOSE_CODES = {
  po_delivery_to_warehouse: 'PO-DEL',
  po_pickup_from_supplier: 'PO-PU',
  part_pickup_for_install: 'PART-PU',
  manual_client_dropoff: 'DROP',
  sample_dropoff: 'SAMP-DO',
  sample_pickup: 'SAMP-PU',
};

function getPurposeCode(logisticsPurpose) {
  return PURPOSE_CODES[logisticsPurpose] || 'LOG';
}

function buildLogisticsJobNumber({ projectNumber, purposeCode, sequence = 1, fallbackShortId }) {
  if (!projectNumber) {
    return `#LOG-${purposeCode}-${fallbackShortId}`;
  }
  
  if (sequence === 1) {
    return `#${projectNumber}-${purposeCode}`;
  }
  
  return `#${projectNumber}-${purposeCode}-${sequence}`;
}

function isLogisticsJobNumber(jobNumber) {
  if (!jobNumber) return false;
  const str = String(jobNumber);
  
  // Project-linked: #1234-PO-PU or #1234-PO-PU-2
  // No-project: #LOG-PO-PU-abc123
  const pattern = /^#(\d+|LOG)-[A-Z]+-[A-Z]+(-[A-Za-z0-9]+)?$/;
  return pattern.test(str);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { limit, dry_run } = await req.json().catch(() => ({}));

    // Load all logistics jobs
    const allJobs = await base44.asServiceRole.entities.Job.filter({ 
      is_logistics_job: true 
    });

    console.log(`Found ${allJobs.length} logistics jobs to process${dry_run ? ' (DRY RUN)' : ''}`);

    // Load all projects for project_number lookup
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const projectById = Object.fromEntries(allProjects.map(p => [p.id, p]));

    // Load all POs for fallback project_number resolution
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    const poById = Object.fromEntries(allPOs.map(po => [po.id, po]));

    // Build index of existing correct job numbers per (projectNumber, purposeCode)
    const existingNumbersIndex = {};
    
    for (const job of allJobs) {
      const jobNum = String(job.job_number || '');
      
      // Only index if already matches logistics pattern
      if (isLogisticsJobNumber(jobNum)) {
        // Extract project number and purpose code
        const match = jobNum.match(/^#(\d+)-([A-Z]+-[A-Z]+)(-\d+)?$/);
        if (match) {
          const [, projectNum, purpose] = match;
          const key = `${projectNum}:${purpose}`;
          if (!existingNumbersIndex[key]) {
            existingNumbersIndex[key] = [];
          }
          existingNumbersIndex[key].push(jobNum);
        }
      }
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const job of allJobs) {
      try {
        // Skip if already has correct format
        if (job.job_number && isLogisticsJobNumber(String(job.job_number))) {
          skipped++;
          continue;
        }

        // Resolve project number
        let projectNumber = null;
        
        if (job.project_id && projectById[job.project_id]) {
          projectNumber = String(projectById[job.project_id].project_number);
        } else if (job.purchase_order_id && poById[job.purchase_order_id]) {
          const po = poById[job.purchase_order_id];
          if (po.project_id && projectById[po.project_id]) {
            projectNumber = String(projectById[po.project_id].project_number);
          }
        }

        // Get purpose code
        const purposeCode = getPurposeCode(job.logistics_purpose);

        // Determine sequence
        let sequence = 1;
        if (projectNumber) {
          const key = `${projectNumber}:${purposeCode}`;
          const existing = existingNumbersIndex[key] || [];
          
          if (existing.length > 0) {
            // Find next available sequence
            const sequences = existing.map(num => {
              const base = `#${projectNumber}-${purposeCode}`;
              if (num === base) return 1;
              
              const seqMatch = num.match(new RegExp(`^${base.replace('#', '\\#')}-(\\d+)$`));
              return seqMatch ? parseInt(seqMatch[1], 10) : 1;
            });
            
            sequence = Math.max(...sequences) + 1;
          }
          
          // Register this new number
          const newJobNumber = buildLogisticsJobNumber({ 
            projectNumber, 
            purposeCode, 
            sequence 
          });
          
          if (!existingNumbersIndex[key]) {
            existingNumbersIndex[key] = [];
          }
          existingNumbersIndex[key].push(newJobNumber);
        }

        // Build job number
        const fallbackShortId = job.id.substring(0, 6);
        const newJobNumber = buildLogisticsJobNumber({
          projectNumber,
          purposeCode,
          sequence: projectNumber ? sequence : null,
          fallbackShortId
        });

        // Update job (unless dry run)
        if (!dry_run) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            job_number: newJobNumber
          });
        }

        console.log(`${dry_run ? '[DRY RUN] Would update' : 'Updated'} job ${job.id}: ${job.job_number || 'null'} -> ${newJobNumber}`);
        updated++;
        
        // Stop if limit reached
        if (limit && updated >= limit) {
          console.log(`Reached limit of ${limit} updates`);
          break;
        }

      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        errors.push({
          job_id: job.id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      dry_run: !!dry_run,
      total_logistics_jobs: allJobs.length,
      updated,
      skipped,
      errors,
      message: dry_run 
        ? `Would update ${updated} jobs (dry run)`
        : `Updated ${updated} jobs successfully`
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});