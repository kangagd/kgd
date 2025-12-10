import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PO_STATUS = {
    DRAFT: "Draft",
    SENT: "Sent",
    ACKNOWLEDGED: "Acknowledged",
    IN_TRANSIT: "In Transit",
    ARRIVED: "Arrived",
    COMPLETED: "Completed",
};

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, data, supplier_id, project_id, delivery_method, delivery_location, line_items, status } = await req.json();

        // Action: create
        if (action === 'create') {
            if (!supplier_id || !line_items || line_items.length === 0) {
                return Response.json({ error: 'supplier_id and non-empty line_items are required' }, { status: 400 });
            }

            const poData = {
                supplier_id,
                project_id: project_id || null,
                status: PO_STATUS.DRAFT,
                delivery_method: delivery_method || PO_DELIVERY_METHOD.DELIVERY,
                delivery_location: delivery_location || null,
                created_by: user.email,
                order_date: new Date().toISOString().split('T')[0],
            };

            const po = await base44.asServiceRole.entities.PurchaseOrder.create(poData);

            // Create line items
            for (const item of line_items) {
                await base44.asServiceRole.entities.PurchaseOrderLine.create({
                    purchase_order_id: po.id,
                    price_list_item_id: item.part_id || null,
                    description: item.name || '',
                    qty_ordered: item.qty,
                    unit_price: item.price || 0,
                });
            }

            return Response.json({ success: true, purchaseOrder: po });
        }

        // Action: update
        if (action === 'update') {
            if (!id) {
                return Response.json({ error: 'id is required for update' }, { status: 400 });
            }

            const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!po) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            const updateData = {};
            if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
            if (project_id !== undefined) updateData.project_id = project_id;
            if (delivery_method !== undefined) updateData.delivery_method = delivery_method;
            if (delivery_location !== undefined) updateData.delivery_location = delivery_location;

            const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

            // Update line items if provided
            if (line_items) {
                // Delete existing lines
                const existingLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: id });
                for (const line of existingLines) {
                    await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
                }
                // Create new lines
                for (const item of line_items) {
                    await base44.asServiceRole.entities.PurchaseOrderLine.create({
                        purchase_order_id: id,
                        price_list_item_id: item.part_id || null,
                        description: item.name || '',
                        qty_ordered: item.qty,
                        unit_price: item.price || 0,
                    });
                }
            }

            return Response.json({ success: true, purchaseOrder: updatedPO });
        }

        // Action: updateStatus
        if (action === 'updateStatus') {
            if (!id || !status) {
                return Response.json({ error: 'id and status are required' }, { status: 400 });
            }

            const validStatuses = Object.values(PO_STATUS);
            if (!validStatuses.includes(status)) {
                return Response.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
            }

            const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!po) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            const updateData = { status };

            // Set timestamps based on status
            if (status === PO_STATUS.SENT) {
                updateData.sent_at = new Date().toISOString();
            } else if (status === PO_STATUS.ARRIVED) {
                updateData.arrived_at = new Date().toISOString();
            }

            const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);
            return Response.json({ success: true, purchaseOrder: updatedPO });
        }

        if (action === 'markAsSent') {
            const poId = id;
            if (!poId) return Response.json({ error: 'Missing PO ID' }, { status: 400 });

            // 1. Update PO status
            const updateData = {
                status: "sent",
                email_sent_at: new Date().toISOString(),
                ...data // Allow passing other fields if needed
            };
            const po = await base44.asServiceRole.entities.PurchaseOrder.update(poId, updateData);

            // 2. Handle Logistics Job for Stock POs
            // Check if it's a stock PO (no project_id) and has a supplier
            // Note: PurchaseOrder entity doesn't have project_id directly on it usually,
            // but if it were linked to a project it might be via PurchaseOrderLine items having project_id or similar.
            // However, the prompt assumes "Stock POs are not linked to projects".
            // We'll check if there's any indication of a project.
            // For now, we assume all POs are candidates for this logic unless we see a project link.
            // Since standard POs created in SupplierPurchaseOrderModal don't seem to link to project_id, 
            // we treat them as stock POs or general POs that need logistics tracking.
            
            if (po.supplier_id) {
                const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                
                // a) Resolve fulfilment method
                let fulfilment = po.fulfilment_method;
                if (!fulfilment && supplier) {
                    const pref = supplier.fulfilment_preference; // "pickup", "delivery", "mixed"
                    if (pref === "pickup" || pref === "delivery") {
                        fulfilment = pref;
                    }
                }
                if (!fulfilment) fulfilment = "delivery"; // Default

                // b) Determine location
                let locationId = po.delivery_location_id;
                let locationName = po.delivery_location_name;
                if (!locationId) {
                    // Default to Main Warehouse if possible, or try to find it
                    const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({ type: "Warehouse" });
                    if (warehouses.length > 0) {
                        locationId = warehouses[0].id;
                        locationName = warehouses[0].name;
                    }
                }

                // c) Determine date
                const scheduledDate = po.expected_date || po.order_date || new Date().toISOString().split('T')[0];

                // Check existing job
                const existingJobs = await base44.asServiceRole.entities.Job.filter({
                    purchase_order_id: po.id
                });

                const jobTypeName = fulfilment === "pickup" ? "Stock – Supplier Pickup" : "Stock – Supplier Delivery";
                
                let address;
                if (fulfilment === "pickup") {
                    address = supplier.pickup_address || supplier.name;
                } else {
                    // Delivery - use the warehouse/location address
                    const location = locationId ? await base44.asServiceRole.entities.InventoryLocation.get(locationId) : null;
                    address = location?.address || locationName || "Warehouse";
                }

                // Build notes with PO info
                let notes = po.notes || '';

                // Get the actual line items with proper item names
                const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: po.id });
                const priceListItemIds = poLines.map(l => l.price_list_item_id).filter(Boolean);
                const priceListItems = priceListItemIds.length > 0 
                    ? await base44.asServiceRole.entities.PriceListItem.filter({ id: { $in: priceListItemIds } })
                    : [];
                
                const itemMap = {};
                for (const item of priceListItems) {
                    itemMap[item.id] = item.item;
                }

                // Build detailed line items summary
                const itemsSummary = poLines.map(line => {
                    const itemName = itemMap[line.price_list_item_id] || line.description || "Item";
                    const qty = line.qty_ordered || 0;
                    return `${qty}x ${itemName}`;
                }).join(', ');

                const jobData = {
                    purchase_order_id: po.id,
                    project_id: null, // Stock PO
                    job_type: jobTypeName,
                    job_type_name: jobTypeName,
                    status: "Scheduled",
                    location_id: locationId,
                    address: address,
                    address_full: address,
                    scheduled_date: scheduledDate,
                    notes: `PO ${po.po_number || po.id} from ${supplier.name} – ${itemsSummary}${notes ? '\n' + notes : ''}`,
                    overview: `${fulfilment === "pickup" ? "Pickup" : "Delivery"} from ${supplier.name}: ${itemsSummary}`,
                    customer_name: supplier.name,
                    image_urls: po.attachments || []
                };

                if (existingJobs.length > 0) {
                    // Update existing
                    await base44.asServiceRole.entities.Job.update(existingJobs[0].id, jobData);
                } else {
                    // Create new
                    // Find or create JobType if needed
                    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                    
                    if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: jobTypeName,
                             description: fulfilment === "pickup" ? "Pickup stock from supplier" : "Receive stock delivery from supplier",
                             color: fulfilment === "pickup" ? "#f59e0b" : "#3b82f6", // Amber or Blue
                             estimated_duration: 1,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                    }

                    await base44.asServiceRole.entities.Job.create({
                        ...jobData,
                        job_type_id: jobTypeId
                    });
                }
            }

            return Response.json({ success: true, po });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});