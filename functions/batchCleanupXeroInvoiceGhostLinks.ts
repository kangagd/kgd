import { createClientFromRequest } from './shared/sdk.js';

// Admin-only batch cleanup function
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[batchCleanupXeroInvoiceGhostLinks] Starting cleanup...');

    // Get all projects with xero_invoices array
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const projectsWithInvoices = allProjects.filter(p => p.xero_invoices && p.xero_invoices.length > 0);

    // Get all XeroInvoice entities with project links
    const allInvoices = await base44.asServiceRole.entities.XeroInvoice.filter({
      project_id: { $ne: null }
    });

    console.log(`[batchCleanupXeroInvoiceGhostLinks] Found ${projectsWithInvoices.length} projects and ${allInvoices.length} invoices to check`);

    const actions = [];
    let projectsUpdated = 0;
    let invoicesUpdated = 0;

    // STEP 1: Clean up projects with invalid invoice references
    for (const project of projectsWithInvoices) {
      try {
        const validInvoiceIds = [];
        
        for (const invoiceId of project.xero_invoices) {
          try {
            const invoice = await base44.asServiceRole.entities.XeroInvoice.get(invoiceId);
            if (invoice) {
              validInvoiceIds.push(invoiceId);
            } else {
              actions.push({
                type: 'removed_ghost_link_from_project',
                project_id: project.id,
                project_number: project.project_number,
                invoice_id: invoiceId,
                reason: 'Invoice entity does not exist'
              });
            }
          } catch (err) {
            actions.push({
              type: 'removed_ghost_link_from_project',
              project_id: project.id,
              project_number: project.project_number,
              invoice_id: invoiceId,
              reason: 'Error fetching invoice: ' + err.message
            });
          }
        }

        // Update project if we removed any invalid references
        if (validInvoiceIds.length !== project.xero_invoices.length) {
          const updates = { xero_invoices: validInvoiceIds };

          // If primary_xero_invoice_id is invalid, update it
          if (project.primary_xero_invoice_id && !validInvoiceIds.includes(project.primary_xero_invoice_id)) {
            updates.primary_xero_invoice_id = validInvoiceIds.length > 0 ? validInvoiceIds[0] : null;
            actions.push({
              type: 'updated_primary_invoice',
              project_id: project.id,
              project_number: project.project_number,
              old_primary: project.primary_xero_invoice_id,
              new_primary: updates.primary_xero_invoice_id
            });
          }

          await base44.asServiceRole.entities.Project.update(project.id, updates);
          projectsUpdated++;
        }
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        actions.push({
          type: 'error',
          project_id: project.id,
          error: error.message
        });
      }
    }

    // STEP 2: Clean up invoices linked to non-existent or incorrect projects
    for (const invoice of allInvoices) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(invoice.project_id);
        
        if (!project) {
          // Project doesn't exist - unlink invoice
          await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
            project_id: null,
            job_id: null,
            customer_id: null,
            customer_name: null
          });
          invoicesUpdated++;
          actions.push({
            type: 'unlinked_invoice_from_deleted_project',
            invoice_id: invoice.id,
            invoice_number: invoice.xero_invoice_number,
            project_id: invoice.project_id
          });
        } else if (!project.xero_invoices || !project.xero_invoices.includes(invoice.id)) {
          // Invoice claims to be linked to project, but project doesn't reference it
          await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
            project_id: null,
            job_id: null,
            customer_id: null,
            customer_name: null
          });
          invoicesUpdated++;
          actions.push({
            type: 'unlinked_orphaned_invoice',
            invoice_id: invoice.id,
            invoice_number: invoice.xero_invoice_number,
            project_id: invoice.project_id,
            project_number: project.project_number
          });
        }
      } catch (error) {
        console.error(`Error processing invoice ${invoice.id}:`, error);
        actions.push({
          type: 'error',
          invoice_id: invoice.id,
          error: error.message
        });
      }
    }

    console.log(`[batchCleanupXeroInvoiceGhostLinks] Complete: ${projectsUpdated} projects, ${invoicesUpdated} invoices updated`);

    return Response.json({
      success: true,
      projects_updated: projectsUpdated,
      invoices_updated: invoicesUpdated,
      total_actions: actions.length,
      actions
    });

  } catch (error) {
    console.error('[batchCleanupXeroInvoiceGhostLinks] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});