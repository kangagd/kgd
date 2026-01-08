import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 1.3: Validate data integrity between old and new systems
 * Compares VehicleStock vs InventoryQuantity to detect discrepancies
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all data
    const [vehicleStocks, inventoryQuantities, locations, vehicles] = await Promise.all([
      base44.asServiceRole.entities.VehicleStock.list(),
      base44.asServiceRole.entities.InventoryQuantity.list(),
      base44.asServiceRole.entities.InventoryLocation.filter({ type: 'vehicle' }),
      base44.asServiceRole.entities.Vehicle.list()
    ]);

    const locationsByVehicleId = new Map(locations.map(loc => [loc.vehicle_id, loc]));
    const vehiclesById = new Map(vehicles.map(v => [v.id, v]));

    const discrepancies = [];
    const matched = [];
    const missingInNew = [];
    const extraInNew = [];

    // Build comparison map from VehicleStock
    const vehicleStockMap = new Map();
    for (const vStock of vehicleStocks) {
      const location = locationsByVehicleId.get(vStock.vehicle_id);
      if (location) {
        const key = `${location.id}_${vStock.product_id}`;
        vehicleStockMap.set(key, {
          vehicle_id: vStock.vehicle_id,
          vehicle_name: vehiclesById.get(vStock.vehicle_id)?.name || 'Unknown',
          product_id: vStock.product_id,
          product_name: vStock.product_name,
          vehicle_stock_quantity: vStock.quantity_on_hand || 0,
          location_id: location.id,
          location_name: location.name
        });
      }
    }

    // Compare with InventoryQuantity
    const inventoryMap = new Map();
    for (const invQty of inventoryQuantities) {
      const location = locations.find(loc => loc.id === invQty.location_id);
      if (location && location.type === 'vehicle') {
        const key = `${invQty.location_id}_${invQty.price_list_item_id}`;
        inventoryMap.set(key, invQty);

        const vStockData = vehicleStockMap.get(key);
        
        if (vStockData) {
          const qtyMatch = vStockData.vehicle_stock_quantity === (invQty.quantity || 0);
          
          if (qtyMatch) {
            matched.push({
              ...vStockData,
              inventory_quantity: invQty.quantity,
              status: '✓ Match'
            });
          } else {
            discrepancies.push({
              ...vStockData,
              inventory_quantity: invQty.quantity,
              difference: (invQty.quantity || 0) - vStockData.vehicle_stock_quantity,
              status: '⚠ Mismatch'
            });
          }
          
          vehicleStockMap.delete(key);
        } else {
          extraInNew.push({
            location_name: invQty.location_name,
            item_name: invQty.item_name,
            quantity: invQty.quantity,
            status: '➕ Extra in InventoryQuantity'
          });
        }
      }
    }

    // Remaining items in vehicleStockMap are missing from InventoryQuantity
    for (const vStockData of vehicleStockMap.values()) {
      missingInNew.push({
        ...vStockData,
        status: '❌ Missing in InventoryQuantity'
      });
    }

    const summary = {
      total_vehicle_stocks: vehicleStocks.length,
      total_inventory_quantities_for_vehicles: inventoryQuantities.filter(q => {
        const loc = locations.find(l => l.id === q.location_id);
        return loc && loc.type === 'vehicle';
      }).length,
      matched: matched.length,
      discrepancies: discrepancies.length,
      missing_in_new: missingInNew.length,
      extra_in_new: extraInNew.length,
      health_score: matched.length > 0 
        ? Math.round((matched.length / (matched.length + discrepancies.length + missingInNew.length)) * 100)
        : 0
    };

    return Response.json({
      success: true,
      summary,
      matched: matched.slice(0, 10), // First 10 for brevity
      discrepancies,
      missing_in_new: missingInNew,
      extra_in_new: extraInNew
    });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});