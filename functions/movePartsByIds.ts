import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { checkInventoryTrackability } from './shared/inventoryTrackingGuardrails.js';

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

    // Guardrail: Physical moves MUST have a source location
    if (physical_move && !from_location_id) {
      return Response.json({ 
        error: 'Physical moves require from_location_id. To move parts logically (without inventory transfer), set physical_move=false' 
      }, { status: 400 });
    }

    // Load destination location to validate it's a real InventoryLocation
    let destLocation;
    try {
      destLocation = await base44.entities.InventoryLocation.get(destination);
    } catch (e) {
      // ID doesn't exist in database
      destLocation = null;
    }

    if (!destLocation) {
      return Response.json({ 
        error: `to_location_id must be a valid InventoryLocation.id. Provided: ${destination}` 
      }, { status: 400 });
    }

    // Load and validate source location (required for physical moves)
    let sourceLocation = null;
    if (from_location_id) {
      try {
        sourceLocation = await base44.entities.InventoryLocation.get(from_location_id);
      } catch (e) {
        sourceLocation = null;
      }

      if (!sourceLocation) {
        return Response.json({ 
          error: `Source location not found. from_location_id must be a valid InventoryLocation.id. Provided: ${from_location_id}` 
        }, { status: 404 });
      }

      // For physical moves, ensure source location is active
      if (physical_move && sourceLocation.is_active === false) {
        return Response.json({ 
          error: `Cannot move from inactive location: ${sourceLocation.name}` 
        }, { status: 400 });
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
        // If physical move, check inventory trackability
        if (physical_move) {
          const trackCheck = checkInventoryTrackability(part);
          if (!trackCheck.isInventoryTracked) {
            errors.push({
              part_id: part.id,
              item_name: part.item_name || part.category || 'Unknown',
              warning_badge: 'Not inventory-tracked',
              reason: trackCheck.reason
            });
            continue;
          }
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
        const partUpdate = {
          location_id: destination
        };

        // When moving to a vehicle location, also update assigned_vehicle_id
        if (destLocation.type === 'vehicle' && destLocation.vehicle_id) {
          partUpdate.assigned_vehicle_id = destLocation.vehicle_id;
        }

        await base44.entities.Part.update(part.id, partUpdate);

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