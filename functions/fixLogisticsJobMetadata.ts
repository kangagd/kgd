import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Purpose code mapping
const JOB_TYPE_TO_LOGISTICS_PURPOSE = {
  'Material Pick Up - Warehouse': 'part_pickup_for_install',
  'Material Pickup – Warehouse': 'part_pickup_for_install',
  'PO Delivery to Warehouse': 'po_delivery_to_warehouse',
  'PO Pickup from Supplier': 'po_pickup_from_supplier',
  'Sample Drop-Off': 'sample_dropoff',
  'Sample Pickup': 'sample_pickup',
  'Client Drop-Off': 'manual_client_dropoff',
};

const PURPOSE_CODES = {
  po_delivery_to_warehouse: 'PO-DEL',
  po_pickup_from_supplier: 'PO-PU',
  part_pickup_for_install: 'PART-PU',
  manual_client_dropoff: 'DROP',
  sample_dropoff: 'SAMP-DO',
  sample_pickup: 'SAMP-PU',
};

function getPurposeCode(logisticsPurpose) {
  return PURPOSE_CODES[logisticsPurpose] || 'UNKNOWN';
}

function buildLogisticsJobNumber({ projectNumber, purposeCode, sequence = 1, fallbackShortId }) {
  if (!projectNumber) {
    return `LOG-${purposeCode}-${fallbackShortId}`;
  }
  
  if (sequence === 1) {
    return `${projectNumber}-${purposeCode}`;
  }
  
  return `${projectNumber}-${purposeCode}-${sequence}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return Response.json({ error: 'job_id required' }, { status: 400 });
    }

    // Load job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Step 1: Determine if this is a logistics job type
    const jobTypeName = job.job_type_name || job.job_type || '';
    const isLogisticsType = Object.keys(JOB_TYPE_TO_LOGISTICS_PURPOSE).some(key =>
      jobTypeName.toLowerCase().includes(key.toLowerCase())
    );

    if (!isLogisticsType) {
      return Response.json({
        success: false,
        reason: 'Job type is not a logistics type',
        job_type: jobTypeName
      }, { status: 400 });
    }

    // Step 2: Map job_type to logistics_purpose
    const logisticsPurpose = JOB_TYPE_TO_LOGISTICS_PURPOSE[jobTypeName] || 'part_pickup_for_install';
    const purposeCode = getPurposeCode(logisticsPurpose);

    // Step 3: Resolve project_number
    let projectNumber = null;
    if (job.project_id) {
      const project = await base44.asServiceRole.entities.Project.get(job.project_id);
      if (project) {
        projectNumber = String(project.project_number);
      }
    }

    // Step 4: Build new job_number
    const fallbackShortId = job.id.substring(0, 6);
    const newJobNumber = buildLogisticsJobNumber({
      projectNumber,
      purposeCode,
      sequence: projectNumber ? 1 : null,
      fallbackShortId
    });

    // Step 5: Update job with all three fields
    const updates = {
      is_logistics_job: true,
      logistics_purpose: logisticsPurpose,
      job_number: newJobNumber
    };

    // Only update project_number if not already set
    if (!job.project_number && projectNumber) {
      updates.project_number = parseInt(projectNumber, 10);
    }

    await base44.asServiceRole.entities.Job.update(job.id, updates);

    return Response.json({
      success: true,
      job_id,
      old_job_number: job.job_number,
      new_job_number: newJobNumber,
      is_logistics_job: true,
      logistics_purpose: logisticsPurpose,
      project_number: projectNumber,
      purpose_code: purposeCode
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});