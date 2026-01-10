import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Check what data exists
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const quantities = await base44.asServiceRole.entities.InventoryQuantity.list();
    const locations = await base44.asServiceRole.entities.InventoryLocation.list();

    // Group quantities by location_name
    const qtyByLocationName = {};
    for (const qty of quantities) {
      if (!qtyByLocationName[qty.location_name]) {
        qtyByLocationName[qty.location_name] = [];
      }
      qtyByLocationName[qty.location_name].push({
        id: qty.id,
        price_list_item_id: qty.price_list_item_id,
        item_name: qty.item_name,
        location_id: qty.location_id,
        quantity: qty.quantity
      });
    }

    return Response.json({
      vehicles_count: vehicles.length,
      vehicles: vehicles.map(v => ({ id: v.id, name: v.name, assigned_user_id: v.assigned_user_id })),
      
      locations_count: locations.length,
      locations: locations.map(l => ({ id: l.id, name: l.name, type: l.type, vehicle_id: l.vehicle_id })),
      
      quantities_count: quantities.length,
      quantities_by_location_name: Object.keys(qtyByLocationName).map(locName => ({
        location_name: locName,
        count: qtyByLocationName[locName].length,
        items: qtyByLocationName[locName].slice(0, 3)
      })),

      unlinked_quantities: quantities.filter(q => !q.location_id).length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});