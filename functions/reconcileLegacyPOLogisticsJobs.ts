import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const dryRun = body.dryRun === false ? false : (body.dry_run === false ? false : true);

    // Find logistics jobs missing modern reference fields
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      is_logistics_job: true
    });

    // Filter jobs that need reconciliation
    const jobsToReconcile = allJobs.filter(job => 
      !job.reference_type || !job.reference_id || !job.legacy_flag
    );

    // Fetch all POs for reference lookup
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    const poMap = {};
    allPOs.forEach(po => {
      poMap[po.id] = po;
    });

    const reconciliationResults = [];

    for (const job of jobsToReconcile) {
      const result = {
        job_id: job.id,
        job_number: job.job_number,
        changes: {},
        notes: [],
        action: 'SKIP' // default
      };

      // Try to find PO reference
      let poId = null;

      // 1. Direct PO reference
      if (job.purchase_order_id) {
        poId = job.purchase_order_id;
        result.notes.push('Found direct purchase_order_id');
      }

      // 2. Infer from job notes or logistics_purpose
      if (!poId && job.notes) {
        const poMatch = job.notes.match(/PO[:\s-]*(\w+)/i);
        if (poMatch) {
          // Try to find PO by number
          const poByNum = allPOs.find(po => po.po_number === poMatch[1]);
          if (poByNum) {
            poId = poByNum.id;
            result.notes.push(`Inferred PO from notes: ${poMatch[1]}`);
          }
        }
      }

      // 3. Infer from logistics_purpose (PO delivery/pickup keywords)
      if (!poId && job.logistics_purpose) {
        if (['po_delivery_to_warehouse', 'po_pickup_from_supplier'].includes(job.logistics_purpose)) {
          // Try to find recent open or delivered PO
          const candidatePOs = allPOs.filter(po => 
            !po.status?.includes('cancelled') && 
            new Date(po.created_date) >= new Date(job.created_date - 7*24*60*60*1000)
          );
          if (candidatePOs.length === 1) {
            poId = candidatePOs[0].id;
            result.notes.push('Inferred single open PO from purpose and timing');
          } else if (candidatePOs.length > 1) {
            result.notes.push(`Found ${candidatePOs.length} possible POs; skipping due to ambiguity`);
          }
        }
      }

      // Prepare update
      if (poId) {
        result.changes.reference_type = 'purchase_order';
        result.changes.reference_id = poId;
        result.action = 'UPDATE';
      }

      // Mark as legacy if not already
      if (!job.legacy_flag) {
        result.changes.legacy_flag = true;
        result.changes.legacy_notes = result.notes.join('; ') || 'Reconciled from legacy logistics job';
        result.action = 'UPDATE';
      }

      // Only mark UPDATE if we actually have changes
      if (Object.keys(result.changes).length === 0) {
        result.action = 'SKIP';
        result.notes.push('Already has modern fields');
      }

      reconciliationResults.push(result);

      // Apply changes if not dryRun
      if (!dryRun && result.action === 'UPDATE') {
        await base44.asServiceRole.entities.Job.update(job.id, result.changes);
      }
    }

    const updateCount = reconciliationResults.filter(r => r.action === 'UPDATE').length;

    return Response.json({
      success: true,
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      jobs_scanned: jobsToReconcile.length,
      jobs_to_update: updateCount,
      results: reconciliationResults,
      message: dryRun 
        ? `${updateCount} jobs would be reconciled (dry run)`
        : `${updateCount} jobs reconciled successfully`
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});