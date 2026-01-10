import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Admin-only function to link orphaned XeroInvoices to their projects
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[linkOrphanedXeroInvoices] Starting...');

    // Get all XeroInvoices
    const allInvoices = await base44.asServiceRole.entities.XeroInvoice.list();
    
    // Get all projects
    const allProjects = await base44.asServiceRole.entities.Project.list();
    
    const linkedCount = [];
    const errors = [];

    for (const invoice of allInvoices) {
      try {
        // Skip if already linked to a project and that project has it in its array
        if (invoice.project_id) {
          const project = await base44.asServiceRole.entities.Project.get(invoice.project_id);
          if (project && project.xero_invoices && project.xero_invoices.includes(invoice.id)) {
            continue; // Already properly linked
          }
        }

        // Try to find the project this invoice belongs to
        let targetProject = null;

        // First, try using project_id if it exists
        if (invoice.project_id) {
          try {
            targetProject = await base44.asServiceRole.entities.Project.get(invoice.project_id);
          } catch (e) {
            // Project doesn't exist, continue searching
          }
        }

        // If not found, try matching by project number (from invoice reference or customer)
        if (!targetProject && invoice.reference) {
          const projectNumberMatch = invoice.reference.match(/Project #(\d+)/);
          if (projectNumberMatch) {
            const projectNumber = parseInt(projectNumberMatch[1]);
            targetProject = allProjects.find(p => p.project_number === projectNumber);
          }
        }

        // If we found the project, link the invoice
        if (targetProject) {
          const xeroInvoices = targetProject.xero_invoices || [];
          if (!xeroInvoices.includes(invoice.id)) {
            xeroInvoices.push(invoice.id);
          }

          // Set primary invoice if not set
          const updates = {
            xero_invoices: xeroInvoices,
            primary_xero_invoice_id: targetProject.primary_xero_invoice_id || invoice.id,
            xero_payment_url: invoice.online_payment_url || targetProject.xero_payment_url
          };

          await base44.asServiceRole.entities.Project.update(targetProject.id, updates);
          
          // Also update invoice to ensure project_id is set
          await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
            project_id: targetProject.id
          });

          linkedCount.push({
            invoice_id: invoice.id,
            invoice_number: invoice.xero_invoice_number,
            project_id: targetProject.id,
            project_number: targetProject.project_number
          });

          console.log(`[linkOrphanedXeroInvoices] Linked invoice ${invoice.xero_invoice_number} to project #${targetProject.project_number}`);
        } else {
          errors.push({
            invoice_id: invoice.id,
            invoice_number: invoice.xero_invoice_number,
            reason: 'Could not find matching project'
          });
        }
      } catch (error) {
        console.error(`Error processing invoice ${invoice.id}:`, error);
        errors.push({
          invoice_id: invoice.id,
          invoice_number: invoice.xero_invoice_number,
          error: error.message
        });
      }
    }

    console.log(`[linkOrphanedXeroInvoices] Complete: ${linkedCount.length} invoices linked`);

    return Response.json({
      success: true,
      linked: linkedCount.length,
      failed: errors.length,
      linked_invoices: linkedCount,
      errors: errors
    });

  } catch (error) {
    console.error('[linkOrphanedXeroInvoices] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});