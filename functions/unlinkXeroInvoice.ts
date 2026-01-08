import { createClientFromRequest } from './shared/sdk.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

/**
 * Unlinks a Xero invoice from its project
 * 
 * CRITICAL: Properly removes all references to prevent stale links
 * 
 * Flow:
 * 1. Clear XeroInvoice.project_id
 * 2. Remove invoice from project's xero_invoices array
 * 3. Clear project's primary_xero_invoice_id if this was primary
 * 4. Clear project's xero_payment_url if no other invoices remain
 */


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

    // Get the invoice
    const invoice = await base44.asServiceRole.entities.XeroInvoice.get(invoiceEntityId);
    
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const projectId = invoice.project_id;

    // STEP 1: Clear invoice's project reference
    await base44.asServiceRole.entities.XeroInvoice.update(invoiceEntityId, {
      project_id: null,
      customer_id: null,
      customer_name: null
    });

    // STEP 2: If invoice was linked to a project, clean up project references
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      
      if (project) {
        const updates = {};
        
        // Remove from xero_invoices array
        if (project.xero_invoices && project.xero_invoices.includes(invoiceEntityId)) {
          updates.xero_invoices = project.xero_invoices.filter(id => id !== invoiceEntityId);
          
          // Clear payment URL if this was the last invoice
          if (updates.xero_invoices.length === 0) {
            updates.xero_payment_url = null;
          }
        }
        
        // Clear primary if this was the primary invoice
        if (project.primary_xero_invoice_id === invoiceEntityId) {
          updates.primary_xero_invoice_id = null;
        }
        
        // Apply updates
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Project.update(projectId, updates);
        }
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