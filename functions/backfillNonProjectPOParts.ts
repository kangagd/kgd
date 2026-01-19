import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getOrCreateSupplierInventoryLocation } from './shared/supplierLocationHelper.js';

/**
 * Backfill migration to create Parts for all non-project PO lines
 * and ensure supplier inventory locations exist
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run = false } = await req.json();

    // Fetch all non-project POs
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    const nonProjectPOs = allPOs.filter(po => !po.project_id && po.status !== 'draft');

    let stats = {
      pos_processed: 0,
      parts_created: 0,
      parts_skipped: 0,
      supplier_locations_created: 0,
      jobs_updated: 0,
      errors: []
    };

    for (const po of nonProjectPOs) {
      try {
        stats.pos_processed++;

        // 1. Ensure supplier location exists
        if (po.supplier_id) {
          try {
            const existingSupplierLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
              type: 'supplier',
              supplier_id: po.supplier_id
            });

            if (existingSupplierLocs.length === 0 && !dry_run) {
              await getOrCreateSupplierInventoryLocation(base44, po.supplier_id);
              stats.supplier_locations_created++;
            }
          } catch (err) {
            console.error(`Error creating supplier location for PO ${po.po_reference}:`, err);
            stats.errors.push(`Supplier location error for PO ${po.po_reference}: ${err.message}`);
          }
        }

        // 2. Fetch PO lines
        const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
          purchase_order_id: po.id
        });

        if (poLines.length === 0) continue;

        // 3. Check existing parts
        const existingParts = await base44.asServiceRole.entities.Part.filter({
          primary_purchase_order_id: po.id
        });

        const existingPartsByLineId = new Map();
        for (const part of existingParts) {
          if (part.po_line_id) {
            existingPartsByLineId.set(part.po_line_id, part);
          }
        }

        const createdParts = [];

        // 4. Create missing Parts
        for (const line of poLines) {
          if (existingPartsByLineId.has(line.id)) {
            stats.parts_skipped++;
            createdParts.push(existingPartsByLineId.get(line.id));
            continue;
          }

          if (dry_run) {
            console.log(`[DRY RUN] Would create Part for PO line: ${line.item_name}`);
            stats.parts_created++;
            continue;
          }

          // Create Part
          const newPart = await base44.asServiceRole.entities.Part.create({
            project_id: null,
            part_scope: "general",
            po_line_id: line.id,
            item_name: line.item_name || line.description || 'Item',
            category: line.category || "Other",
            quantity_required: line.qty_ordered || 1,
            status: "on_order",
            location: "supplier",
            primary_purchase_order_id: po.id,
            purchase_order_ids: [po.id],
            supplier_id: po.supplier_id,
            supplier_name: po.supplier_name,
            po_number: po.po_reference,
            order_reference: po.po_reference,
            order_date: po.order_date,
            eta: po.expected_date,
            price_list_item_id: line.price_list_item_id || line.source_id || null,
          });

          createdParts.push(newPart);
          stats.parts_created++;

          // Update PO line with part_id
          await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
            part_id: newPart.id
          });
        }

        // 5. Update linked logistics job if exists
        if (po.linked_logistics_job_id && createdParts.length > 0) {
          try {
            const job = await base44.asServiceRole.entities.Job.get(po.linked_logistics_job_id);
            
            if (job && !dry_run) {
              // Rebuild checked_items to use Part IDs
              const newCheckedItems = {};
              for (const part of createdParts) {
                newCheckedItems[part.id] = job.checked_items?.[part.po_line_id] || false;
              }

              // Get supplier location
              let supplierLocationId = job.source_location_id;
              if (!supplierLocationId && po.supplier_id) {
                const supplierLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
                  type: 'supplier',
                  supplier_id: po.supplier_id
                });
                supplierLocationId = supplierLocs[0]?.id || null;
              }

              await base44.asServiceRole.entities.Job.update(job.id, {
                checked_items: newCheckedItems,
                source_location_id: supplierLocationId
              });

              // Link parts to job
              for (const part of createdParts) {
                const currentLinks = Array.isArray(part.linked_logistics_jobs) ? part.linked_logistics_jobs : [];
                if (!currentLinks.includes(job.id)) {
                  await base44.asServiceRole.entities.Part.update(part.id, {
                    linked_logistics_jobs: [...currentLinks, job.id]
                  });
                }
              }

              stats.jobs_updated++;
            }
          } catch (err) {
            console.error(`Error updating job for PO ${po.po_reference}:`, err);
            stats.errors.push(`Job update error for PO ${po.po_reference}: ${err.message}`);
          }
        }

      } catch (err) {
        console.error(`Error processing PO ${po.po_reference}:`, err);
        stats.errors.push(`PO ${po.po_reference}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      dry_run,
      stats,
      message: dry_run 
        ? `[DRY RUN] Would create ${stats.parts_created} parts, ${stats.supplier_locations_created} supplier locations`
        : `Created ${stats.parts_created} parts, ${stats.supplier_locations_created} supplier locations, updated ${stats.jobs_updated} jobs`
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});