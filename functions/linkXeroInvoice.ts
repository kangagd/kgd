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
    const { project_id, xero_invoice_id } = normalizeParams(body);
    const invoiceEntityId = body.invoiceEntityId || body.invoice_entity_id;
    const invoiceSnapshot = body.invoice_snapshot || body.invoice;
    
    // Log for debugging
    console.log('[linkXeroInvoice] Received:', { project_id, xero_invoice_id, invoiceEntityId, hasSnapshot: !!invoiceSnapshot });

    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    if (!xero_invoice_id && !invoiceEntityId) {
      return Response.json({ error: 'Either xero_invoice_id or invoiceEntityId is required' }, { status: 400 });
    }

    // Find or create the XeroInvoice entity
    let invoiceEntity;
    if (invoiceEntityId) {
      invoiceEntity = await base44.asServiceRole.entities.XeroInvoice.get(invoiceEntityId);
    } else if (xero_invoice_id) {
      const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ 
        xero_invoice_id 
      });
      invoiceEntity = invoices[0];
      
      // Upsert: create if doesn't exist
      if (!invoiceEntity) {
        if (!invoiceSnapshot) {
          return Response.json({ 
            error: 'Invoice not found in database. Please provide invoice_snapshot to create it.' 
          }, { status: 400 });
        }
        
        // Create new XeroInvoice entity from snapshot
        invoiceEntity = await base44.asServiceRole.entities.XeroInvoice.create({
          xero_invoice_id: invoiceSnapshot.xero_invoice_id || xero_invoice_id,
          xero_invoice_number: invoiceSnapshot.xero_invoice_number || invoiceSnapshot.invoice_number,
          contact_name: invoiceSnapshot.contact_name,
          reference: invoiceSnapshot.reference,
          status: invoiceSnapshot.status,
          total: invoiceSnapshot.total,
          total_amount: invoiceSnapshot.total,
          amount_due: invoiceSnapshot.amount_due,
          amount_paid: invoiceSnapshot.amount_paid,
          date: invoiceSnapshot.date || invoiceSnapshot.issue_date,
          issue_date: invoiceSnapshot.issue_date || invoiceSnapshot.date,
          due_date: invoiceSnapshot.due_date,
          online_payment_url: invoiceSnapshot.online_payment_url || invoiceSnapshot.online_invoice_url,
          pdf_url: invoiceSnapshot.pdf_url,
          project_id: project_id // Link immediately on creation
        });
        
        console.log('[linkXeroInvoice] Created new invoice entity:', invoiceEntity.id);
      }
    }

    const oldProjectId = invoiceEntity.project_id;

    // STEP 1: If linked to a different project, unlink it first (idempotent string comparison)
    if (oldProjectId && String(oldProjectId) !== String(project_id)) {
      try {
        const oldProject = await base44.asServiceRole.entities.Project.get(oldProjectId);
        
        if (oldProject) {
          // Standardize to string array for comparison
          const currentInvoices = (oldProject.xero_invoices || []).map(String);
          const invoiceIdStr = String(invoiceEntity.id);
          
          // Only update if invoice is actually in the array
          if (currentInvoices.includes(invoiceIdStr)) {
            const updatedInvoices = currentInvoices.filter(id => String(id) !== invoiceIdStr);
            await base44.asServiceRole.entities.Project.update(oldProjectId, {
              xero_invoices: updatedInvoices
            });
            console.log('[linkXeroInvoice] Unlinked from old project:', oldProjectId);
          }
        }
      } catch (e) {
        console.error('[linkXeroInvoice] Error unlinking from old project:', e);
        // Continue anyway - link to new project
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

    // STEP 4: Add invoice to project's xero_invoices array (deduplicate, string-only IDs)
    const currentInvoices = (project.xero_invoices || []).map(String);
    const invoiceIdStr = String(invoiceEntity.id);
    
    // Only add if not already in the array (idempotent)
    const updatedInvoices = currentInvoices.includes(invoiceIdStr)
      ? currentInvoices
      : [...currentInvoices, invoiceIdStr];

    const projectUpdates = {
      xero_invoices: updatedInvoices
    };

    // Only set payment URL if project doesn't have one already
    if (!project.xero_payment_url && (invoiceEntity.online_payment_url || invoiceEntity.online_invoice_url)) {
      projectUpdates.xero_payment_url = invoiceEntity.online_payment_url || invoiceEntity.online_invoice_url;
    }

    console.log('[linkXeroInvoice] Updating project:', { 
      project_id, 
      before: project.xero_invoices, 
      after: updatedInvoices,
      invoice_entity_id: invoiceEntity.id
    });

    await base44.asServiceRole.entities.Project.update(project_id, projectUpdates);

    return Response.json({
      success: true,
      invoice_entity_id: invoiceEntity.id,
      xero_invoice_id: invoiceEntity.xero_invoice_id,
      linked_to_project: project_id,
      unlinked_from_project: oldProjectId || null
    });

  } catch (error) {
    console.error('Link Xero invoice error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});