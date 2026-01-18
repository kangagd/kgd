import { createClientFromRequest } from './shared/sdk.js';

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

    // Clear invoice's project reference
    await base44.asServiceRole.entities.XeroInvoice.update(invoiceEntityId, {
      project_id: null,
      job_id: null,
      customer_id: null,
      customer_name: null
    });

    // Remove from linked project (STRING ID normalization)
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      
      if (project) {
        // Normalize to string array for comparison
        const currentInvoices = (project.xero_invoices || []).map(String);
        const invoiceIdStr = String(invoiceEntityId);
        
        // Only update if invoice is actually in the array
        if (currentInvoices.includes(invoiceIdStr)) {
          const updates = {
            xero_invoices: currentInvoices.filter(id => String(id) !== invoiceIdStr)
          };
          
          // Clear payment URL if no invoices left
          if (updates.xero_invoices.length === 0) {
            updates.xero_payment_url = null;
          }
          
          await base44.asServiceRole.entities.Project.update(projectId, updates);
        }
      }
    }
    
    // Scan for and fix any ghost links in other projects (STRING normalization)
    const allProjects = await base44.asServiceRole.entities.Project.filter({
      xero_invoices: { $in: [invoiceEntityId] }
    });
    
    for (const proj of allProjects) {
      if (proj.id !== projectId) {
        const currentInvoices = (proj.xero_invoices || []).map(String);
        const invoiceIdStr = String(invoiceEntityId);
        const cleanedInvoices = currentInvoices.filter(id => String(id) !== invoiceIdStr);
        
        await base44.asServiceRole.entities.Project.update(proj.id, {
          xero_invoices: cleanedInvoices
        });
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