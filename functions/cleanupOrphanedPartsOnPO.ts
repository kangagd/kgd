import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { purchase_order_ids, batch_all } = await req.json();
    
    let posToProcess = [];
    
    if (batch_all) {
      // Process all POs
      posToProcess = await base44.asServiceRole.entities.PurchaseOrder.list('-created_date', 1000);
    } else if (purchase_order_ids && Array.isArray(purchase_order_ids)) {
      // Process specified POs
      for (const id of purchase_order_ids) {
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
        if (po) posToProcess.push(po);
      }
    } else {
      return Response.json({ error: 'purchase_order_ids array or batch_all=true required' }, { status: 400 });
    }

    if (posToProcess.length === 0) {
      return Response.json({ error: 'No POs found to process' }, { status: 404 });
    }

    // Get all parts linked to this PO (both primary and legacy)
    const partsByPrimary = await base44.asServiceRole.entities.Part.filter({
      primary_purchase_order_id: po.id
    });
    
    const partsByLegacy = await base44.asServiceRole.entities.Part.filter({
      purchase_order_id: po.id
    });

    const allParts = [...partsByPrimary, ...partsByLegacy];

    // Find orphaned parts (po_line_id is null)
    const orphanedParts = allParts.filter(p => !p.po_line_id);

    // Delete orphaned parts
    const deletedIds = [];
    for (const orphan of orphanedParts) {
      try {
        await base44.asServiceRole.entities.Part.delete(orphan.id);
        deletedIds.push(orphan.id);
      } catch (err) {
        console.error(`Failed to delete orphaned part ${orphan.id}:`, err.message);
      }
    }

    // Get PO lines and create parts for any missing ones
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id: po.id
    });

    // Map existing parts by po_line_id
    const partsWithLineIds = allParts.filter(p => p.po_line_id);
    const existingLineIds = new Set(partsWithLineIds.map(p => p.po_line_id));

    // Helper: Map PO status to part status
    const mapPoStatusToPartStatus = (poStatus) => {
      const statusMap = {
        'draft': 'pending',
        'sent': 'on_order',
        'on_order': 'on_order',
        'in_transit': 'in_transit',
        'in_loading_bay': 'in_loading_bay',
        'at_supplier': 'at_supplier',
        'in_storage': 'in_storage',
        'in_vehicle': 'in_vehicle',
        'installed': 'installed',
        'cancelled': 'cancelled'
      };
      return statusMap[poStatus] || 'pending';
    };

    // Helper: Map PO status to part location
    const mapPoStatusToLocation = (poStatus) => {
      const locationMap = {
        'draft': 'supplier',
        'sent': 'supplier',
        'on_order': 'supplier',
        'in_transit': 'in_transit',
        'in_loading_bay': 'loading_bay',
        'at_supplier': 'supplier',
        'in_storage': 'warehouse_storage',
        'in_vehicle': 'vehicle',
        'installed': 'client_site',
        'cancelled': 'supplier'
      };
      return locationMap[poStatus] || 'supplier';
    };

    // Create parts for missing PO lines
    const createdIds = [];
    const updatedLineIds = [];
    for (const line of poLines) {
      if (!existingLineIds.has(line.id)) {
        try {
          const newPart = await base44.asServiceRole.entities.Part.create({
            project_id: po.project_id || null,
            po_line_id: line.id,
            item_name: line.item_name || line.description || 'Part',
            category: line.category || 'Other',
            quantity_required: line.qty_ordered || 1,
            price_list_item_id: line.price_list_item_id || null,
            supplier_id: po.supplier_id || null,
            supplier_name: po.supplier_name || null,
            status: mapPoStatusToPartStatus(po.status),
            location: mapPoStatusToLocation(po.status),
            source_type: 'supplier_delivery',
            purchase_order_ids: [po.id],
            primary_purchase_order_id: po.id,
            purchase_order_id: po.id, // legacy mirror
            po_number: po.po_reference || po.po_number || null,
            order_reference: line.order_reference || null
          });
          createdIds.push(newPart.id);
          
          // Link PO line back to part
          try {
            await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
              part_id: newPart.id
            });
            updatedLineIds.push(line.id);
          } catch (err) {
            console.error(`Failed to update PO line ${line.id} with part_id:`, err.message);
          }
        } catch (err) {
          console.error(`Failed to create part for PO line ${line.id}:`, err.message);
        }
      }
    }

    return Response.json({
      po_id: po.id,
      po_reference: po.po_reference,
      orphaned_parts_deleted: deletedIds.length,
      deleted_part_ids: deletedIds,
      missing_parts_created: createdIds.length,
      created_part_ids: createdIds,
      po_lines_updated_with_part_id: updatedLineIds.length,
      updated_line_ids: updatedLineIds
    });

  } catch (error) {
    console.error('Error cleaning up orphaned parts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});