import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { stop_confirmation_id } = await req.json();

    if (!stop_confirmation_id) {
      return Response.json({ 
        success: false, 
        reason: 'missing_stop_confirmation_id' 
      }, { status: 400 });
    }

    // Load StopConfirmation
    let confirmation;
    try {
      confirmation = await base44.asServiceRole.entities.StopConfirmation.get(stop_confirmation_id);
    } catch (error) {
      return Response.json({ 
        success: false, 
        reason: 'missing_confirmation',
        error: error.message 
      }, { status: 404 });
    }

    // Load LogisticsStop
    let stop;
    try {
      stop = await base44.asServiceRole.entities.LogisticsStop.get(confirmation.stop_id);
    } catch (error) {
      return Response.json({ 
        success: false, 
        reason: 'missing_stop',
        error: error.message 
      }, { status: 404 });
    }

    // Check if this is a loading bay delivery stop
    if (stop.purpose !== 'po_delivery_loading_bay') {
      return Response.json({ 
        success: true, 
        skipped: true, 
        reason: 'not_loading_bay_delivery',
        stop_purpose: stop.purpose
      });
    }

    // Idempotency check: look for existing receipt
    let existingReceipts = [];
    try {
      const byConfirmation = await base44.asServiceRole.entities.Receipt.filter({
        source_confirmation_id: stop_confirmation_id
      });
      const byStop = await base44.asServiceRole.entities.Receipt.filter({
        source_stop_id: stop.id
      });
      const map = new Map();
      [...byConfirmation, ...byStop].forEach(r => map.set(r.id, r));
      existingReceipts = Array.from(map.values());
    } catch (error) {
      return Response.json({
        success: false,
        reason: 'receipt_idempotency_query_failed',
        error: error.message
      }, { status: 500 });
    }

    if (existingReceipts.length > 0) {
      return Response.json({ 
        success: true, 
        receipt_id: existingReceipts[0].id,
        existed: true
      });
    }

    console.log('[ensureReceipt] stop', stop.id, 'purpose', stop.purpose, 'confirmation', confirmation.id);

    // Determine location_id
    const location_id = stop.location_id || null;

    // Calculate SLA times
    const received_at = confirmation.completed_at || new Date().toISOString();
    const sla_clock_start_at = received_at;
    
    // Add 48 hours for SLA deadline
    const sla_due_date = new Date(sla_clock_start_at);
    sla_due_date.setHours(sla_due_date.getHours() + 48);
    const sla_due_at = sla_due_date.toISOString();

    // Fetch cached display fields from related entities
    let project_number = null, project_title = null, po_number = null, supplier_id = null, supplier_name = null;
    
    if (stop.project_id) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(stop.project_id);
        project_number = project.project_number || null;
        project_title = project.title || null;
      } catch (err) {
        console.warn('[ensureReceipt] Could not fetch project for caching:', err.message);
      }
    }
    
    if (stop.purchase_order_id) {
      try {
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(stop.purchase_order_id);
        po_number = po.po_number || null;
        supplier_id = po.supplier_id || null;
        supplier_name = po.supplier_name || null;
      } catch (err) {
        console.warn('[ensureReceipt] Could not fetch PO for caching:', err.message);
      }
    }

    // Create Receipt
    const receipt = await base44.asServiceRole.entities.Receipt.create({
      project_id: stop.project_id || null,
      project_number: project_number,
      project_title: project_title,
      purchase_order_id: stop.purchase_order_id || null,
      po_number: po_number,
      supplier_id: supplier_id,
      supplier_name: supplier_name,
      location_id: location_id,
      received_by_user_id: confirmation.completed_by_user_id,
      received_by_name: confirmation.completed_by_name,
      received_at: received_at,
      notes: confirmation.notes || '',
      photos_json: confirmation.photos_json || null,
      source_type: 'po_delivery_stop',
      source_stop_id: stop.id,
      source_confirmation_id: confirmation.id,
      sla_clock_start_at: sla_clock_start_at,
      sla_due_at: sla_due_at,
      status: 'open'
    });

    return Response.json({ 
      success: true, 
      receipt_id: receipt.id,
      existed: false,
      sla_due_at: sla_due_at
    });

  } catch (error) {
    console.error('Error in ensureReceiptForStopConfirmation:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});