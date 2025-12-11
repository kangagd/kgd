import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Migration script to normalize Purchase Order statuses
 * Run this once to update all existing POs to use canonical status values
 */

const STATUS_MIGRATIONS = {
  "On Order": "on_order",
  "In Transit": "in_transit",
  "Delivered - Loading Bay": "delivered_loading_bay",
  "Delivered to Delivery Bay": "delivered_loading_bay",
  "Ready for Pick up": "delivered_loading_bay",
  "Ready to Pick Up": "delivered_loading_bay",
  "In Storage": "in_storage",
  "Completed - In Storage": "in_storage",
  "In Vehicle": "in_vehicle",
  "Completed - In Vehicle": "in_vehicle",
  "Installed": "installed",
  "Sent": "sent",
  "Cancelled": "cancelled",
  "Draft": "draft",
  // Old DB statuses
  "sent": "sent",
  "received": "in_storage",
  "partially_received": "in_transit",
  "cancelled": "cancelled",
  "draft": "draft",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    // Fetch all POs
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    
    let migrated = 0;
    let unchanged = 0;
    let errors = 0;
    const details = [];

    for (const po of allPOs) {
      const oldStatus = po.status;
      const newStatus = STATUS_MIGRATIONS[oldStatus];

      if (newStatus && newStatus !== oldStatus) {
        try {
          await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
            status: newStatus
          });
          migrated++;
          details.push({
            id: po.id,
            po_number: po.po_number,
            old: oldStatus,
            new: newStatus
          });
        } catch (error) {
          errors++;
          details.push({
            id: po.id,
            po_number: po.po_number,
            old: oldStatus,
            error: error.message
          });
        }
      } else {
        unchanged++;
      }
    }

    return Response.json({
      success: true,
      summary: {
        total: allPOs.length,
        migrated,
        unchanged,
        errors
      },
      details
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});