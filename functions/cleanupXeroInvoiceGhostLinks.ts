import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all projects with invoices
    const projects = await base44.asServiceRole.entities.Project.filter({ 
      xero_invoices: { $ne: [] } 
    });

    // Get all invoices with project links
    const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ 
      project_id: { $ne: null } 
    });

    const results = {
      projects_checked: projects.length,
      invoices_checked: invoices.length,
      projects_fixed: 0,
      invoices_orphaned: 0,
      ghost_links_removed: 0,
      errors: []
    };

    // Build a map of invoice_id -> project_id from invoices
    const invoiceToProjectMap = {};
    invoices.forEach(inv => {
      invoiceToProjectMap[inv.id] = inv.project_id;
    });

    // Check each project for ghost links
    for (const project of projects) {
      try {
        const validInvoices = [];
        let hadGhosts = false;

        for (const invoiceId of project.xero_invoices) {
          const actualProjectId = invoiceToProjectMap[invoiceId];
          
          if (actualProjectId === project.id) {
            validInvoices.push(invoiceId);
          } else {
            hadGhosts = true;
            results.ghost_links_removed++;
          }
        }

        if (hadGhosts) {
          await base44.asServiceRole.entities.Project.update(project.id, {
            xero_invoices: validInvoices,
            primary_xero_invoice_id: validInvoices.length > 0 ? validInvoices[0] : null
          });
          results.projects_fixed++;
        }
      } catch (error) {
        results.errors.push({
          project_id: project.id,
          project_number: project.project_number,
          error: error.message
        });
      }
    }

    // Build reverse map to check for orphaned invoices
    const projectInvoiceMap = {};
    projects.forEach(proj => {
      proj.xero_invoices.forEach(invId => {
        projectInvoiceMap[invId] = proj.id;
      });
    });

    // Clear orphaned invoices
    for (const invoice of invoices) {
      try {
        if (invoice.project_id && !projectInvoiceMap[invoice.id]) {
          await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
            project_id: null
          });
          results.invoices_orphaned++;
        }
      } catch (error) {
        results.errors.push({
          invoice_id: invoice.id,
          invoice_number: invoice.xero_invoice_number,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      summary: `Fixed ${results.projects_fixed} projects, removed ${results.ghost_links_removed} ghost links, cleared ${results.invoices_orphaned} orphaned invoices`,
      details: results
    });

  } catch (error) {
    console.error('cleanupXeroInvoiceGhostLinks error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});