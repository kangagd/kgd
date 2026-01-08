import { createClientFromRequest } from './shared/sdk.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { invoiceEntityId } = body;

    if (!invoiceEntityId) {
      return Response.json({ error: 'invoiceEntityId is required' }, { status: 400 });
    }

    const invoice = await base44.asServiceRole.entities.XeroInvoice.get(invoiceEntityId);
    
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const projectId = invoice.project_id;

    await base44.asServiceRole.entities.XeroInvoice.update(invoiceEntityId, {
      project_id: null,
      job_id: null,
      customer_id: null,
      customer_name: null
    });

    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      
      if (project) {
        const updates = {};
        
        if (project.xero_invoices && project.xero_invoices.includes(invoiceEntityId)) {
          updates.xero_invoices = project.xero_invoices.filter(id => id !== invoiceEntityId);
          
          if (updates.xero_invoices.length === 0) {
            updates.xero_payment_url = null;
          }
        }
        
        if (project.primary_xero_invoice_id === invoiceEntityId) {
          updates.primary_xero_invoice_id = updates.xero_invoices && updates.xero_invoices.length > 0 
            ? updates.xero_invoices[0] 
            : null;
        }
        
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Project.update(projectId, updates);
        }
      }
    }
    
    // Scan for and fix any ghost links in other projects
    const allProjects = await base44.asServiceRole.entities.Project.filter({
      xero_invoices: { $in: [invoiceEntityId] }
    });
    
    for (const proj of allProjects) {
      if (proj.id !== projectId) {
        const cleanedInvoices = (proj.xero_invoices || []).filter(id => id !== invoiceEntityId);
        const updates = { xero_invoices: cleanedInvoices };
        
        if (proj.primary_xero_invoice_id === invoiceEntityId) {
          updates.primary_xero_invoice_id = cleanedInvoices.length > 0 ? cleanedInvoices[0] : null;
        }
        
        await base44.asServiceRole.entities.Project.update(proj.id, updates);
      }
    }

    return Response.json({
      success: true,
      unlinked_from_project: projectId
    });

  } catch (error) {
    console.error('Unlink Xero invoice error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});