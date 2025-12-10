import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PO_STATUS = {
  DRAFT: "Draft",
  ON_ORDER: "On Order",
  SENT: "Sent",
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

        const { 
            part_id, 
            supplier_id, 
            project_id, 
            source_type,
            internal_reference,
            requested_eta,
            notes_to_supplier
        } = await req.json();

        // Validate required fields
        if (!part_id || !supplier_id || !project_id) {
            return Response.json({ 
                error: 'part_id, supplier_id, and project_id are required' 
            }, { status: 400 });
        }

        // Fetch the Part
        const part = await base44.asServiceRole.entities.Part.get(part_id);
        if (!part) {
            return Response.json({ error: 'Part not found' }, { status: 404 });
        }

        // Validate source type
        const validSupplierSources = [
            "Supplier – Deliver to Warehouse",
            "Supplier – Pickup Required"
        ];
        if (!validSupplierSources.includes(source_type)) {
            return Response.json({ 
                error: 'Invalid source_type. Must be a supplier source type.' 
            }, { status: 400 });
        }

        // Get supplier details
        const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
        if (!supplier) {
            return Response.json({ error: 'Supplier not found' }, { status: 404 });
        }

        // Try to find existing draft PO for this supplier + project
        const existingPOs = await base44.asServiceRole.entities.PurchaseOrder.filter({
            supplier_id: supplier_id,
            project_id: project_id,
            status: PO_STATUS.DRAFT
        });

        let purchaseOrder;
        
        if (existingPOs.length > 0) {
            // Use the first matching draft PO
            purchaseOrder = existingPOs[0];
        } else {
            // Create a new draft PO
            const deliveryMethod = source_type === "Supplier – Deliver to Warehouse" 
                ? PO_DELIVERY_METHOD.DELIVERY 
                : PO_DELIVERY_METHOD.PICKUP;

            const poData = {
                supplier_id: supplier_id,
                supplier_name: supplier.name,
                project_id: project_id,
                status: PO_STATUS.DRAFT,
                delivery_method: deliveryMethod,
                notes: notes_to_supplier || null,
                po_number: internal_reference || null,
                expected_date: requested_eta || null,
                created_by: user.email,
                order_date: new Date().toISOString().split('T')[0],
            };

            purchaseOrder = await base44.asServiceRole.entities.PurchaseOrder.create(poData);
        }

        // Check if this part already has a line item in this PO
        const existingLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
            purchase_order_id: purchaseOrder.id,
            part_id: part_id
        });

        if (existingLines.length === 0) {
            // Create a new line item for this part
            const lineData = {
                purchase_order_id: purchaseOrder.id,
                source_type: "project_part",
                source_id: part_id,
                part_id: part_id,
                price_list_item_id: part.price_list_item_id || null,
                item_name: part.category || "Part",
                description: part.notes || part.category || "Part",
                qty_ordered: part.quantity_required || 1,
                unit_cost_ex_tax: 0, // Can be updated later
                unit: null,
                tax_rate_percent: 0,
                total_line_ex_tax: 0,
                notes: part.notes || null
            };

            await base44.asServiceRole.entities.PurchaseOrderLine.create(lineData);
        }

        // Update the Part with PO link and procurement status
        const today = new Date().toISOString().split('T')[0];
        const partUpdateData = {
            purchase_order_id: purchaseOrder.id,
            po_number: purchaseOrder.po_number || purchaseOrder.internal_reference || null,
            supplier_id: supplier_id,
            supplier_name: supplier.name
        };

        // Update status if currently Pending
        if (part.status === "Pending") {
            partUpdateData.status = "Ordered";
        }

        // Set order_date if empty
        if (!part.order_date) {
            partUpdateData.order_date = today;
        }

        // Set location if empty
        if (!part.location) {
            partUpdateData.location = "On Order";
        }

        await base44.asServiceRole.entities.Part.update(part_id, partUpdateData);

        // Sync PurchaseOrder status: if PO is still Draft, update to On Order when part is linked
        if (purchaseOrder.status === PO_STATUS.DRAFT) {
            await base44.asServiceRole.entities.PurchaseOrder.update(purchaseOrder.id, { 
                status: PO_STATUS.ON_ORDER 
            });
        }

        return Response.json({ 
            success: true, 
            purchaseOrderId: purchaseOrder.id,
            message: "Part linked to purchase order successfully"
        });

    } catch (error) {
        console.error('Error in createOrAttachPurchaseOrderForPart:', error);
        return Response.json({ 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
});