import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { syncVehicleStockQuantity, syncMovementRecord } from './shared/dualWriteInventory.js';

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
            // Mark used on job - now uses moveInventory instead of manageVehicleStock
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
        }

        if (action === 'adjust') {
            // Manual adjustment - now uses moveInventory instead of manageVehicleStock
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
        }

        if (action === 'restock') {
            // Admin restocking vehicle - now uses moveInventory instead of manageVehicleStock
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
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
                 // ARCHIVED: VehicleStockMovement writes disabled

                // Update stock (dual-write to both systems)
                await syncVehicleStockQuantity(base44, vehicle_id, productId, newQty, product.item);

                // Record movement
                const locations = await base44.asServiceRole.entities.InventoryLocation.filter({ 
                  vehicle_id, 
                  type: 'vehicle' 
                });
                const locationId = locations.length > 0 ? locations[0].id : null;

                await syncMovementRecord(base44, {
                  vehicleId: vehicle_id,
                  productId: productId,
                  jobId: null,
                  projectId: null,
                  movementType: 'adjustment',
                  quantityChange: qty,
                  reason: 'Initial addition of custom item',
                  userId: user.id,
                  userName: user.full_name || user.email,
                  fromLocationId: null,
                  toLocationId: locationId,
                  itemName: product.item
                });
            }

            return Response.json({ success: true, product_id: productId, new_quantity: newQty });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});