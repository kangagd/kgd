import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const serviceBase44 = base44.asServiceRole;

    // Find invoice 3723 in database
    const allInvoices = await serviceBase44.entities.XeroInvoice.list('-created_date', 2000);
    const invoice3723 = allInvoices.find(inv => 
      inv.xero_invoice_number === '3723' || 
      inv.xero_invoice_number === '#3723'
    );

    if (!invoice3723) {
      return Response.json({
        found: false,
        message: 'Invoice 3723 not found in database',
        searched: allInvoices.length
      });
    }

    // Check linked entities
    let linkedProject = null;
    let linkedJob = null;

    if (invoice3723.project_id) {
      try {
        linkedProject = await serviceBase44.entities.Project.get(invoice3723.project_id);
      } catch (err) {
        linkedProject = { error: 'Failed to fetch', message: err.message };
      }
    }

    if (invoice3723.job_id) {
      try {
        linkedJob = await serviceBase44.entities.Job.get(invoice3723.job_id);
      } catch (err) {
        linkedJob = { error: 'Failed to fetch', message: err.message };
      }
    }

    return Response.json({
      found: true,
      invoice: {
        id: invoice3723.id,
        xero_invoice_id: invoice3723.xero_invoice_id,
        xero_invoice_number: invoice3723.xero_invoice_number,
        project_id: invoice3723.project_id,
        job_id: invoice3723.job_id,
        customer_id: invoice3723.customer_id,
        customer_name: invoice3723.customer_name,
        status: invoice3723.status,
        total: invoice3723.total
      },
      linked_project: linkedProject ? {
        id: linkedProject.id,
        project_number: linkedProject.project_number,
        title: linkedProject.title,
        deleted_at: linkedProject.deleted_at,
        customer_name: linkedProject.customer_name
      } : null,
      linked_job: linkedJob ? {
        id: linkedJob.id,
        job_number: linkedJob.job_number,
        deleted_at: linkedJob.deleted_at,
        customer_name: linkedJob.customer_name
      } : null,
      diagnosis: {
        has_project_link: !!invoice3723.project_id,
        has_job_link: !!invoice3723.job_id,
        project_deleted: linkedProject?.deleted_at ? true : false,
        job_deleted: linkedJob?.deleted_at ? true : false
      }
    });

  } catch (error) {
    console.error('[debugInvoice3723] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});