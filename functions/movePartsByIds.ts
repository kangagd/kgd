import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      part_ids,
      from_location_id = null,
      to_location_id = null,
      to_vehicle_location_id = null,
      physical_move = false,
      quantity_override = null,
      notes = null
    } = body;

    // Validate inputs
    if (!part_ids || !Array.isArray(part_ids) || part_ids.length === 0) {
      return Response.json({ error: 'part_ids must be a non-empty array' }, { status: 400 });
    }

    // Resolve destination location
    const destination = to_vehicle_location_id || to_location_id;
    if (!destination) {
      return Response.json({ error: 'Must provide to_location_id or to_vehicle_location_id' }, { status: 400 });
    }

    // Load destination location to validate and get name
    const destLocation = await base44.entities.InventoryLocation.get(destination);
    if (!destLocation) {
      return Response.json({ error: 'Destination location not found' }, { status: 404 });
    }

    // Load source location if provided
    let sourceLocation = null;
    if (from_location_id) {
      sourceLocation = await base44.entities.InventoryLocation.get(from_location_id);
      if (!sourceLocation) {
        return Response.json({ error: 'Source location not found' }, { status: 404 });
      }
    }

    // Load all parts
    const parts = await Promise.all(
      part_ids.map(id => base44.entities.Part.get(id).catch(() => null))
    );

    const validParts = parts.filter(p => p !== null);
    if (validParts.length === 0) {
      return Response.json({ error: 'No valid parts found' }, { status: 404 });
    }

    const errors = [];
    let moved_count = 0;

    // Process each part
    for (const part of validParts) {
      try {
        // If physical move, validate price_list_item_id
        if (physical_move && !part.price_list_item_id) {
          errors.push({
            part_id: part.id,
            reason: 'Missing price_list_item_id - cannot perform physical inventory move'
          });
          continue;
        }

        // Physical move: update inventory quantities
        if (physical_move) {
          const qty = quantity_override ?? 1;
          
          // Call canonical moveInventory function
          const moveResponse = await base44.functions.invoke('moveInventory', {
            priceListItemId: part.price_list_item_id,
            fromLocationId: from_location_id,
            toLocationId: destination,
            quantity: qty,
            source: 'transfer',
            notes: notes || `Part ${part.item_name || part.category} moved`
          });

          if (moveResponse.data?.error) {
            errors.push({
              part_id: part.id,
              reason: moveResponse.data.error
            });
            continue;
          }
        }

        // Update Part.location_id (both logical and physical moves)
        await base44.entities.Part.update(part.id, {
          location_id: destination
        });

        moved_count++;

      } catch (error) {
        errors.push({
          part_id: part.id,
          reason: error.message
        });
      }
    }

    return Response.json({
      success: true,
      moved_count,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully moved ${moved_count} of ${validParts.length} parts to ${destLocation.name}`
    });

  } catch (error) {
    console.error('movePartsByIds error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});