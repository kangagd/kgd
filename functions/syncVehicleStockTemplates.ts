import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admin can run this sync
        if (user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Get all PriceListItems with car_quantity > 0
        const allItems = await base44.asServiceRole.entities.PriceListItem.list('item');
        const templateItems = allItems.filter(item => (item.car_quantity || 0) > 0);

        // Get all active vehicles
        const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ 
            status: 'Active' 
        });

        if (vehicles.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'No active vehicles found',
                synced: 0 
            });
        }

        let syncedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        // For each vehicle, ensure all template items are added
        for (const vehicle of vehicles) {
            for (const item of templateItems) {
                // Check if this item already exists for this vehicle
                const existing = await base44.asServiceRole.entities.VehicleStock.filter({
                    vehicle_id: vehicle.id,
                    product_id: item.id
                });

                if (existing.length === 0) {
                    // Create new VehicleStock record
                    await base44.asServiceRole.entities.VehicleStock.create({
                        vehicle_id: vehicle.id,
                        product_id: item.id,
                        product_name: item.item,
                        sku: item.sku || '',
                        category: item.category,
                        quantity_on_hand: 0,
                        minimum_target_quantity: item.car_quantity
                    });
                    createdCount++;
                } else {
                    // Update minimum_target_quantity if it changed
                    const stockRecord = existing[0];
                    if (stockRecord.minimum_target_quantity !== item.car_quantity) {
                        await base44.asServiceRole.entities.VehicleStock.update(stockRecord.id, {
                            minimum_target_quantity: item.car_quantity
                        });
                        updatedCount++;
                    }
                }
                syncedCount++;
            }
        }

        return Response.json({ 
            success: true, 
            message: 'Vehicle stock templates synced successfully',
            template_items: templateItems.length,
            vehicles: vehicles.length,
            total_synced: syncedCount,
            created: createdCount,
            updated: updatedCount
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});