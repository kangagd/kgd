import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PO_DELIVERY_METHOD, LOGISTICS_PURPOSE } from './shared/constants.ts';
import { getOrCreateSupplierInventoryLocation } from './shared/supplierLocationHelper.ts';
import { getPurposeCode, buildLogisticsJobNumber } from './shared/logisticsJobNumbering.js';
import { getNextLogisticsSequence, buildCounterKey } from './shared/atomicLogisticsCounter.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { purchase_order_id, technician_id, scheduled_date } = await req.json();

        if (!purchase_order_id) {
            return Response.json({ 
                success: false, 
                error: 'purchase_order_id is required' 
            }, { status: 400 });
        }

        // Fetch the PO
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(purchase_order_id);
        if (!po) {
            return Response.json({ 
                success: false, 
                error: 'Purchase Order not found' 
            }, { status: 404 });
        }

        // GUARDRAIL: For supplier-based logistics, PO must have a supplier
        if (
            (po.delivery_method === PO_DELIVERY_METHOD.PICKUP || po.delivery_method === PO_DELIVERY_METHOD.DELIVERY) &&
            !po.supplier_id
        ) {
            return Response.json({ 
                success: false, 
                error: 'PO supplier is required for supplier pickup/delivery logistics jobs.' 
            }, { status: 400 });
        }

        // Determine logistics purpose and job type based on delivery method
        let logisticsPurpose, jobTypeName, originAddress, destinationAddress;
        
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            logisticsPurpose = LOGISTICS_PURPOSE.PO_PICKUP_FROM_SUPPLIER;
            jobTypeName = "Ready for Pick Up - Supplier";
        } else {
            // Default to DELIVERY
            logisticsPurpose = LOGISTICS_PURPOSE.PO_DELIVERY_TO_WAREHOUSE;
            jobTypeName = "Delivery in Loading Bay";
        }
            
        let jobTypes = await base44.asServiceRole.entities.JobType.filter({ 
            name: jobTypeName 
        });
        
        if (jobTypes.length === 0) {
            return Response.json({ 
                success: false, 
                error: `JobType "${jobTypeName}" not found. Please ensure it exists.` 
            }, { status: 400 });
        }
        
        const jobTypeId = jobTypes[0].id;

        // Get supplier name and address
        let supplierName = "Supplier";
        let supplierAddress = "";
        if (po.supplier_id) {
            try {
                const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                if (supplier) {
                    supplierName = supplier.name;
                    supplierAddress = supplier.pickup_address || supplier.address_full || supplier.address_street || "";
                }
            } catch (error) {
                console.error('Error fetching supplier:', error);
            }
        }

        // Fetch the warehouse location
         let warehouseLocation = null;
         try {
             const warehouseLocations = await base44.asServiceRole.entities.InventoryLocation.filter({ 
                 type: 'warehouse',
                 is_active: true
             });
             warehouseLocation = warehouseLocations.length > 0 ? warehouseLocations[0] : null;
         } catch (err) {
             console.error('Error fetching warehouse location:', err);
         }

         // GUARDRAIL: Validate warehouse location exists (no hard-coded fallback)
         if (!warehouseLocation) {
             return Response.json({ 
                 success: false, 
                 error: 'No active warehouse location found. Please create a warehouse InventoryLocation first.' 
             }, { status: 400 });
         }
         
         const warehouseAddress = warehouseLocation.address;
         const warehouseLocationId = warehouseLocation.id;

         // Get or create supplier inventory location (FAIL-FAST: required for logistics job)
         if (!po.supplier_id) {
             return Response.json({ 
                 success: false, 
                 error: 'PO must have a supplier_id to create logistics job' 
             }, { status: 400 });
         }

         const supplierLocation = await getOrCreateSupplierInventoryLocation(base44, po.supplier_id);
         const supplierLocationId = supplierLocation?.id;

         if (!supplierLocationId) {
             throw new Error('Failed to create or retrieve supplier inventory location. Cannot create logistics job without source_location_id.');
         }
         let jobTitle, jobAddressFull;
        
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            // Pickup from supplier
            jobTitle = `${supplierName} - Pickup`;
            jobAddressFull = supplierAddress || supplierName;
            originAddress = supplierAddress || supplierName;
            destinationAddress = warehouseAddress;
        } else {
            // Delivery to warehouse
            jobTitle = `${supplierName} - Delivery`;
            jobAddressFull = warehouseAddress;
            originAddress = supplierAddress || supplierName;
            destinationAddress = warehouseAddress;
        }

        // Generate logistics job number using atomic counter
        let projectNumber = null;
        if (po.project_id) {
            const project = await base44.asServiceRole.entities.Project.get(po.project_id);
            projectNumber = project?.project_number ? String(project.project_number) : null;
        }

        const purposeCode = getPurposeCode(logisticsPurpose);
        
        // Atomically get next sequence using LogisticsJobCounter
        const counterKey = buildCounterKey({
            project_id: po.project_id,
            project_number: projectNumber,
            purposeCode
        });
        const sequence = await getNextLogisticsSequence(base44, counterKey);

        const fallbackShortId = po.id.substring(0, 6);
        const jobNumber = buildLogisticsJobNumber({
            projectNumber,
            purposeCode,
            sequence: projectNumber ? sequence : null,
            fallbackShortId
        });

        // Get PO lines
        const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
            purchase_order_id: po.id
        });

        // Build checked_items - use PO line IDs for non-project POs, Part IDs for project POs
        const checkedItems = {};

        // ALWAYS fetch existing Parts for this PO (both by primary_purchase_order_id AND purchase_order_id to catch all)
        const partsByPrimary = await base44.asServiceRole.entities.Part.filter({
            primary_purchase_order_id: po.id
        });
        const partsByLegacy = await base44.asServiceRole.entities.Part.filter({
            purchase_order_id: po.id
        });
        
        // Merge and deduplicate
        const existingPartsMap = new Map();
        [...partsByPrimary, ...partsByLegacy].forEach(p => existingPartsMap.set(p.id, p));
        const existingParts = Array.from(existingPartsMap.values());

        // Map existing parts by po_line_id for quick lookup
        const existingPartsByLineId = new Map();
        for (const part of existingParts) {
            if (part.po_line_id) {
                existingPartsByLineId.set(part.po_line_id, part);
            }
        }

        const newlyCreatedParts = [];
        for (const line of poLines) {
            // Check if Part already exists for this PO line
             if (existingPartsByLineId.has(line.id)) {
                 const part = existingPartsByLineId.get(line.id);
                 // Ensure required fields are populated
                 const updates = {};
                 if (!part.item_name && line.item_name) {
                     updates.item_name = line.item_name;
                 }
                 if (!part.primary_purchase_order_id) {
                     updates.primary_purchase_order_id = po.id;
                 }
                 // CRITICAL: Ensure project_id is set for project POs
                 if (po.project_id && !part.project_id) {
                     updates.project_id = po.project_id;
                 }
                 if (Object.keys(updates).length > 0) {
                     await base44.asServiceRole.entities.Part.update(part.id, updates);
                     Object.assign(part, updates);
                 }
                 continue;
             }

            // No Part exists - create one
            console.log(`Creating Part for PO line ${line.id}: ${line.item_name}`);
            const newPart = await base44.asServiceRole.entities.Part.create({
                project_id: po.project_id || null,
                part_scope: po.project_id ? "project" : "general",
                po_line_id: line.id,
                item_name: line.item_name || line.description || 'Item',
                category: line.category || "Other",
                quantity_required: line.qty_ordered || 1,
                status: "on_order",
                location: "supplier",
                primary_purchase_order_id: po.id,
                purchase_order_id: po.id,
                purchase_order_ids: [po.id],
                supplier_id: po.supplier_id,
                supplier_name: po.supplier_name,
                po_number: po.po_reference,
                order_reference: po.po_reference,
                order_date: po.order_date,
                eta: po.expected_date,
                price_list_item_id: line.price_list_item_id || line.source_id || null,
            });
            newlyCreatedParts.push(newPart);
            console.log(`Created Part ${newPart.id} for PO line ${line.id}`);

            // Update PO line with the new part_id
            await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
                part_id: newPart.id
            });
        }
        
        console.log(`Total Parts for PO ${po.id}: ${existingParts.length + newlyCreatedParts.length} (${existingParts.length} existing, ${newlyCreatedParts.length} created)`);

        // ALWAYS use Part IDs in checked_items (deduplicated: existing + newly created)
        const allParts = [...existingParts, ...newlyCreatedParts];
        for (const part of allParts) {
            checkedItems[part.id] = false;
        }

        // Create the Job with checked_items and proper locations
        const jobData = {
            job_number: jobNumber,
            job_type_id: jobTypeId,
            job_type: jobTypeName,
            job_type_name: jobTypeName,
            purchase_order_id: po.id,
            status: "Open",
            scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
            assigned_to: technician_id ? [technician_id] : [],
            notes: `Logistics job for PO from ${supplierName}`,
            address: jobAddressFull,
            address_full: jobAddressFull,
            customer_name: jobTitle,
            is_logistics_job: true,
            logistics_purpose: logisticsPurpose,
            origin_address: originAddress,
            destination_address: destinationAddress,
            reference_type: 'purchase_order',
            reference_id: po.id,
            source_location_id: supplierLocationId,
            destination_location_id: warehouseLocationId,
            stock_transfer_status: 'not_started',
            checked_items: checkedItems,
        };

        // Add project_id only if it exists
        if (po.project_id) {
            jobData.project_id = po.project_id;
        }

        const job = await base44.asServiceRole.entities.Job.create(jobData);

        // Update PO with linked job reference
        const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
            linked_logistics_job_id: job.id
        });

        // Link Parts to this Job with error handling
        const linkingErrors = [];
        for (const part of allParts) {
            try {
                const currentLinks = Array.isArray(part.linked_logistics_jobs) ? part.linked_logistics_jobs : [];
                if (!currentLinks.includes(job.id)) {
                    await base44.asServiceRole.entities.Part.update(part.id, {
                        linked_logistics_jobs: [...currentLinks, job.id]
                    });
                }
            } catch (linkError) {
                console.error(`Failed to link Part ${part.id} to Job ${job.id}:`, linkError);
                linkingErrors.push({ partId: part.id, error: linkError.message });
            }
        }

        return Response.json({
            success: true,
            job: job,
            purchaseOrder: updatedPO,
            partsCreated: allParts.length,
            supplierLocationCreated: !!supplierLocation,
            linkingErrors: linkingErrors.length > 0 ? linkingErrors : undefined
        });

    } catch (error) {
        console.error('Error creating logistics job for PO:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});