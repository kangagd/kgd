import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run !== false;

    console.log('[cleanupDeletedEntityInvoices] Starting...', { dry_run });

    const serviceBase44 = base44.asServiceRole;

    // Get all XeroInvoices
    const allInvoices = await serviceBase44.entities.XeroInvoice.list('-created_date', 5000);
    console.log(`Found ${allInvoices.length} total invoices`);

    // Get all projects and jobs
    const allProjects = await serviceBase44.entities.Project.list('-created_date', 5000);
    const allJobs = await serviceBase44.entities.Job.list('-created_date', 5000);

    // Create sets of deleted entity IDs
    const deletedProjectIds = new Set(
      allProjects.filter(p => p.deleted_at).map(p => p.id)
    );
    const deletedJobIds = new Set(
      allJobs.filter(j => j.deleted_at).map(j => j.id)
    );

    console.log(`Found ${deletedProjectIds.size} deleted projects and ${deletedJobIds.size} deleted jobs`);

    const actions = [];
    let cleaned = 0;

    // Check each invoice
    for (const invoice of allInvoices) {
      const linkedToDeletedProject = invoice.project_id && deletedProjectIds.has(invoice.project_id);
      const linkedToDeletedJob = invoice.job_id && deletedJobIds.has(invoice.job_id);

      if (linkedToDeletedProject || linkedToDeletedJob) {
        const updateData = {};
        
        if (linkedToDeletedProject) {
          updateData.project_id = null;
          updateData.customer_id = null;
          updateData.customer_name = null;
        }
        
        if (linkedToDeletedJob) {
          updateData.job_id = null;
          updateData.job_number = null;
        }

        if (!dry_run) {
          await serviceBase44.entities.XeroInvoice.update(invoice.id, updateData);
          cleaned++;
        }

        actions.push({
          invoice_number: invoice.xero_invoice_number,
          action: dry_run ? 'would_unlink' : 'unlinked',
          linked_to_deleted_project: linkedToDeletedProject,
          linked_to_deleted_job: linkedToDeletedJob,
          cleared_fields: Object.keys(updateData)
        });
      }
    }

    return Response.json({
      success: true,
      dry_run,
      invoices_checked: allInvoices.length,
      invoices_cleaned: cleaned,
      actions,
      summary: dry_run 
        ? `Would unlink ${actions.length} invoices from deleted entities`
        : `Unlinked ${cleaned} invoices from deleted entities`
    });

  } catch (error) {
    console.error('[cleanupDeletedEntityInvoices] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});