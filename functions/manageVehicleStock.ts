import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, data } = await req.json();

        // data fields: vehicle_id, product_id, quantity, job_id, reason, new_quantity
        
        // Verify vehicle access for technicians
        if (user.role !== 'admin' && user.role !== 'manager') {
            if (action !== 'consume' && action !== 'restock_request' && action !== 'adjust') {
                 // Technicians can consume, request restock (handled elsewhere usually but maybe logic here), adjust
                 // But strictly speaking, technicians can only touch their OWN vehicle
                 const vehicle = await base44.entities.Vehicle.get(data.vehicle_id);
                 if (!vehicle || vehicle.assigned_user_id !== user.id) {
                     return Response.json({ error: 'Unauthorized access to vehicle' }, { status: 403 });
                 }
            }
        }

        if (action === 'consume') {
            // Mark used on job
            const { vehicle_id, product_id, quantity, job_id, reason } = data;
            
            if (!quantity || quantity <= 0) throw new Error("Quantity must be positive");

            // Get current stock
            const stockList = await base44.entities.VehicleStock.filter({ vehicle_id, product_id });
            const currentStock = stockList[0];
            
            if (!currentStock) throw new Error("Product not found in vehicle");

            const newQty = (currentStock.quantity_on_hand || 0) - quantity;

            // Create movement
            await base44.entities.VehicleStockMovement.create({
                vehicle_id,
                product_id,
                job_id,
                movement_type: 'ConsumeOnJob',
                quantity_change: -quantity,
                reason: reason || 'Used on job',
                performed_by_user_id: user.id,
                performed_by_user_name: user.full_name || user.email
            });

            // Update stock
            await base44.entities.VehicleStock.update(currentStock.id, {
                quantity_on_hand: newQty
            });

            return Response.json({ success: true, new_quantity: newQty });
        }

        if (action === 'adjust') {
            // Manual adjustment
            const { vehicle_id, product_id, new_quantity, reason } = data;
            
            const stockList = await base44.entities.VehicleStock.filter({ vehicle_id, product_id });
            let currentStock = stockList[0];
            let oldQty = 0;

            if (!currentStock) {
                // Create if doesn't exist? Or error? 
                // Better to create if we are adjusting stock that wasn't tracked
                const product = await base44.entities.PriceListItem.get(product_id);
                currentStock = await base44.entities.VehicleStock.create({
                    vehicle_id,
                    product_id,
                    product_name: product.item,
                    sku: product.sku, // assuming PriceListItem has sku or similar
                    category: product.category,
                    quantity_on_hand: 0
                });
            } else {
                oldQty = currentStock.quantity_on_hand || 0;
            }

            const diff = new_quantity - oldQty;
            if (diff === 0) return Response.json({ success: true, new_quantity: new_quantity });

            // Create movement
            await base44.entities.VehicleStockMovement.create({
                vehicle_id,
                product_id,
                movement_type: 'Adjustment',
                quantity_change: diff,
                reason: reason || 'Manual adjustment',
                performed_by_user_id: user.id,
                performed_by_user_name: user.full_name || user.email
            });

            // Update stock
            await base44.entities.VehicleStock.update(currentStock.id, {
                quantity_on_hand: new_quantity
            });

            return Response.json({ success: true, new_quantity });
        }

        if (action === 'restock') {
            // Admin restocking vehicle (from warehouse)
            const { vehicle_id, product_id, quantity, reason } = data;
            
            if (!quantity || quantity <= 0) throw new Error("Quantity must be positive");

            const stockList = await base44.entities.VehicleStock.filter({ vehicle_id, product_id });
            let currentStock = stockList[0];

            if (!currentStock) {
                 const product = await base44.entities.PriceListItem.get(product_id);
                 currentStock = await base44.entities.VehicleStock.create({
                    vehicle_id,
                    product_id,
                    product_name: product.item,
                    sku: product.sku,
                    category: product.category,
                    quantity_on_hand: 0
                });
            }

            const newQty = (currentStock.quantity_on_hand || 0) + quantity;

            await base44.entities.VehicleStockMovement.create({
                vehicle_id,
                product_id,
                movement_type: 'RestockFromWarehouse',
                quantity_change: quantity,
                reason: reason || 'Restock',
                performed_by_user_id: user.id,
                performed_by_user_name: user.full_name || user.email
            });

            await base44.entities.VehicleStock.update(currentStock.id, {
                quantity_on_hand: newQty
            });

            return Response.json({ success: true, new_quantity: newQty });
        }

        if (action === 'create_product_and_add') {
            const { vehicle_id, product_details, initial_quantity } = data;
            // product_details: { item, category, price, description }
            
            // Check if product with same name already exists
            const existing = await base44.entities.PriceListItem.filter({ item: product_details.item });
            let productId;
            let product;

            if (existing && existing.length > 0) {
                // Use existing
                product = existing[0];
                productId = product.id;
            } else {
                // Create new product using service role (to bypass admin-only RLS)
                product = await base44.asServiceRole.entities.PriceListItem.create({
                    item: product_details.item,
                    category: product_details.category || 'Other',
                    price: product_details.price || 0,
                    description: product_details.description || '',
                    in_inventory: true,
                    stock_level: 0
                });
                productId = product.id;
            }

            // Now add to vehicle stock (same logic as adjust/restock)
            // Check if already in vehicle
            const stockList = await base44.entities.VehicleStock.filter({ vehicle_id, product_id: productId });
            let currentStock = stockList[0];
            
            if (!currentStock) {
                currentStock = await base44.entities.VehicleStock.create({
                    vehicle_id,
                    product_id: productId,
                    product_name: product.item,
                    category: product.category,
                    quantity_on_hand: 0
                });
            }

            const qty = initial_quantity || 0;
            const newQty = (currentStock.quantity_on_hand || 0) + qty;

            if (qty > 0) {
                 await base44.entities.VehicleStockMovement.create({
                    vehicle_id,
                    product_id: productId,
                    movement_type: 'Adjustment', // Initial add
                    quantity_change: qty,
                    reason: 'Initial addition of custom item',
                    performed_by_user_id: user.id,
                    performed_by_user_name: user.full_name || user.email
                });

                await base44.entities.VehicleStock.update(currentStock.id, {
                    quantity_on_hand: newQty
                });
            }

            return Response.json({ success: true, product_id: productId, new_quantity: newQty });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});