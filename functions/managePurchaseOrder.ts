import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = await req.json();
        const { action, id } = payload;

        // Action: create
        if (action === 'create') {
            const { supplier_id, line_items = [] } = payload;
            
            if (!supplier_id) {
                return Response.json({ error: 'supplier_id is required' }, { status: 400 });
            }

            const poData = {
                ...payload,
                created_by: user.email,
                status: payload.status || 'draft',
                order_date: new Date().toISOString().split('T')[0]
            };

            const po = await base44.asServiceRole.entities.PurchaseOrder.create(poData);

            if (po.project_id) {
                await updateProjectActivity(base44, po.project_id, 'PO Created');
            }

            return Response.json({ success: true, purchaseOrder: po });
        }

        // Action: update
        if (action === 'update') {
            if (!id) {
                return Response.json({ error: 'id is required' }, { status: 400 });
            }

            const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!po) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            const updateData = { ...payload };
            delete updateData.action;
            delete updateData.id;

            const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

            if (updatedPO.project_id) {
                await updateProjectActivity(base44, updatedPO.project_id, 'PO Updated');
            }

            return Response.json({ success: true, purchaseOrder: updatedPO });
        }

        // Action: delete
        if (action === 'delete') {
            if (!id) {
                return Response.json({ error: 'id is required' }, { status: 400 });
            }

            await base44.asServiceRole.entities.PurchaseOrder.delete(id);
            return Response.json({ success: true });
        }

        // Action: markAsSent (legacy)
        if (action === 'markAsSent') {
            if (!id) return Response.json({ error: 'Missing PO ID' }, { status: 400 });

            const updateData = {
                status: "sent",
                email_sent_at: new Date().toISOString(),
                ...payload
            };
            const po = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

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