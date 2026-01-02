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

        // Fetch ALL existing VehicleStock records at once
        const allVehicleStock = await base44.asServiceRole.entities.VehicleStock.list('id');
        
        // Build lookup map: "vehicleId_productId" -> stockRecord
        const stockLookup = {};
        for (const stock of allVehicleStock) {
            const key = `${stock.vehicle_id}_${stock.product_id}`;
            stockLookup[key] = stock;
        }

        const recordsToCreate = [];
        const recordsToUpdate = [];

        // For each vehicle, ensure all template items are added
        for (const vehicle of vehicles) {
            for (const item of templateItems) {
                const key = `${vehicle.id}_${item.id}`;
                const existing = stockLookup[key];

                if (!existing) {
                    // Prepare for bulk create
                    recordsToCreate.push({
                        vehicle_id: vehicle.id,
                        product_id: item.id,
                        product_name: item.item,
                        sku: item.sku || '',
                        category: item.category,
                        quantity_on_hand: 0,
                        minimum_target_quantity: item.car_quantity
                    });
                } else if (existing.minimum_target_quantity !== item.car_quantity) {
                    // Prepare for update
                    recordsToUpdate.push({
                        id: existing.id,
                        minimum_target_quantity: item.car_quantity
                    });
                }
            }
        }

        // Bulk create new records
        if (recordsToCreate.length > 0) {
            await base44.asServiceRole.entities.VehicleStock.bulkCreate(recordsToCreate);
        }

        // Batch update existing records with delays to prevent rate limiting
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const batchSize = 10;
        
        for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
            const batch = recordsToUpdate.slice(i, i + batchSize);
            await Promise.all(
                batch.map(update => 
                    base44.asServiceRole.entities.VehicleStock.update(update.id, {
                        minimum_target_quantity: update.minimum_target_quantity
                    })
                )
            );
            
            // Delay between batches
            if (i + batchSize < recordsToUpdate.length) {
                await delay(300);
            }
        }

        const syncedCount = recordsToCreate.length + recordsToUpdate.length;
        const createdCount = recordsToCreate.length;
        const updatedCount = recordsToUpdate.length;

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