import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { normalizeParams } from './shared/parameterNormalizer.js';

/**
 * Links a Xero invoice to a project
 * 
 * CRITICAL: Properly handles unlinking from previous project to prevent stale references
 * 
 * Flow:
 * 1. Find the XeroInvoice entity (by xero_invoice_id or entity id)
 * 2. If already linked to a different project, unlink it (remove from array + clear primary)
 * 3. Update XeroInvoice.project_id to new project
 * 4. Add invoice to new project's xero_invoices array
 * 5. Optionally set as primary invoice
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { project_id } = normalizeParams(body);
    const { xeroInvoiceId, invoiceEntityId, setPrimary = false } = body;

    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    if (!xeroInvoiceId && !invoiceEntityId) {
      return Response.json({ error: 'Either xeroInvoiceId or invoiceEntityId is required' }, { status: 400 });
    }

    // Find the XeroInvoice entity
    let invoiceEntity;
    if (invoiceEntityId) {
      invoiceEntity = await base44.asServiceRole.entities.XeroInvoice.get(invoiceEntityId);
    } else {
      const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ 
        xero_invoice_id: xeroInvoiceId 
      });
      invoiceEntity = invoices[0];
      
      if (!invoiceEntity) {
        return Response.json({ error: 'Invoice not found in database' }, { status: 404 });
      }
    }

    const oldProjectId = invoiceEntity.project_id;

    // STEP 1: If linked to a different project, unlink it first
    if (oldProjectId && oldProjectId !== project_id) {
      const oldProject = await base44.asServiceRole.entities.Project.get(oldProjectId);
      
      if (oldProject) {
        const updates = {};
        
        // Remove from xero_invoices array
        if (oldProject.xero_invoices && oldProject.xero_invoices.includes(invoiceEntity.id)) {
          updates.xero_invoices = oldProject.xero_invoices.filter(id => id !== invoiceEntity.id);
        }
        
        // Clear primary if this was the primary invoice
        if (oldProject.primary_xero_invoice_id === invoiceEntity.id) {
          updates.primary_xero_invoice_id = null;
        }
        
        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Project.update(oldProjectId, updates);
        }
      }
    }

    // STEP 2: Get the target project
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // STEP 3: Update XeroInvoice to link to new project
    await base44.asServiceRole.entities.XeroInvoice.update(invoiceEntity.id, {
      project_id: project_id,
      customer_id: project.customer_id,
      customer_name: project.customer_name
    });

    // STEP 4: Add invoice to project's xero_invoices array (deduplicate)
    const currentInvoices = project.xero_invoices || [];
    const updatedInvoices = [...currentInvoices, invoiceEntity.id]
      .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

    const projectUpdates = {
      xero_invoices: updatedInvoices,
      xero_payment_url: invoiceEntity.online_payment_url || invoiceEntity.online_invoice_url || project.xero_payment_url
    };

    // STEP 5: Optionally set as primary
    if (setPrimary || !project.primary_xero_invoice_id) {
      projectUpdates.primary_xero_invoice_id = invoiceEntity.id;
    }

    await base44.asServiceRole.entities.Project.update(project_id, projectUpdates);

    return Response.json({
      success: true,
      invoice: invoiceEntity,
      unlinked_from_project: oldProjectId,
      linked_to_project: project_id,
      set_as_primary: setPrimary || !project.primary_xero_invoice_id
    });

  } catch (error) {
    console.error('Link Xero invoice error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});