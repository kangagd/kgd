import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Safely deduplicate vehicle InventoryLocation records.
 * For each vehicle_id, ensures exactly one active location remains.
 * 
 * SAFETY:
 * - Does NOT delete any records
 * - Does NOT modify StockMovement history
 * - Only sets is_active = false on confirmed duplicates
 * - Leaves audit trail in description field
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only operation
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all active vehicle locations
    const vehicleLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'vehicle',
      vehicle_id: { $exists: true, $ne: null },
      is_active: true
    });

    // Group by vehicle_id
    const groupsByVehicleId = new Map();
    for (const loc of vehicleLocations) {
      const vehicleId = loc.vehicle_id;
      if (!groupsByVehicleId.has(vehicleId)) {
        groupsByVehicleId.set(vehicleId, []);
      }
      groupsByVehicleId.get(vehicleId).push(loc);
    }

    const winners = [];
    const deactivatedDuplicates = [];

    // Process groups with duplicates
    for (const [vehicleId, locations] of groupsByVehicleId.entries()) {
      if (locations.length === 1) {
        // No duplicates, this is the winner by default
        winners.push({
          vehicle_id: vehicleId,
          winner_location_id: locations[0].id,
          winner_location_code: locations[0].location_code,
          winner_name: locations[0].name
        });
        continue;
      }

      // Multiple locations for this vehicle - select winner
      const winner = selectWinner(locations, vehicleId);
      winners.push({
        vehicle_id: vehicleId,
        winner_location_id: winner.id,
        winner_location_code: winner.location_code,
        winner_name: winner.name
      });

      // Deactivate all losers
      const losers = locations.filter(loc => loc.id !== winner.id);
      
      for (const loser of losers) {
        const auditNote = `\n[Auto-retired S11.3 ${new Date().toISOString().split('T')[0]}] Duplicate vehicle location; winner=${winner.id} location_code=${winner.location_code}`;
        const updatedDescription = (loser.description || '') + auditNote;

        await base44.asServiceRole.entities.InventoryLocation.update(loser.id, {
          is_active: false,
          description: updatedDescription
        });

        deactivatedDuplicates.push({
          vehicle_id: vehicleId,
          location_id: loser.id,
          name: loser.name,
          location_code: loser.location_code
        });
      }
    }

    return Response.json({
      status: 'SUCCESS',
      summary: `Processed ${groupsByVehicleId.size} vehicles: deactivated ${deactivatedDuplicates.length} duplicates, kept ${winners.length} canonical locations`,
      vehicle_groups_total: groupsByVehicleId.size,
      groups_with_duplicates: deactivatedDuplicates.length > 0 ? winners.filter(w => 
        deactivatedDuplicates.some(d => d.vehicle_id === w.vehicle_id)
      ).length : 0,
      winners: winners,
      deactivated_duplicates: deactivatedDuplicates
    });

  } catch (error) {
    console.error('deduplicateVehicleInventoryLocations error:', error);
    return Response.json({ 
      error: error.message,
      status: 'ERROR'
    }, { status: 500 });
  }
});

/**
 * Select winner from multiple locations for the same vehicle
 * 
 * Winner Selection Rules:
 * 1. Prefer location_code exactly equals "VEHICLE_{vehicle_id}"
 * 2. If tied, prefer name starting with "Vehicle:" exactly once (not "Vehicle: Vehicle:")
 * 3. If still tied, prefer most recently updated, or earliest created, or stable sort by id
 */
function selectWinner(locations, vehicleId) {
  if (locations.length === 0) return null;
  if (locations.length === 1) return locations[0];

  const expectedCode = `VEHICLE_${vehicleId}`;

  // Rule 1: Prefer exact location_code match
  const exactMatch = locations.find(loc => loc.location_code === expectedCode);
  if (exactMatch) return exactMatch;

  // Rule 2: Prefer clean "Vehicle:" name (not duplicated prefix)
  const cleanNameCandidates = locations.filter(loc => {
    const name = loc.name || '';
    return name.startsWith('Vehicle:') && !name.startsWith('Vehicle: Vehicle:');
  });

  if (cleanNameCandidates.length === 1) {
    return cleanNameCandidates[0];
  }

  // If multiple clean names or none, use temporal sorting
  const candidates = cleanNameCandidates.length > 0 ? cleanNameCandidates : locations;

  // Rule 3: Sort by updated_date (desc), then created_date (asc), then id (asc)
  const sorted = [...candidates].sort((a, b) => {
    // Most recent update first
    if (a.updated_date && b.updated_date) {
      return new Date(b.updated_date) - new Date(a.updated_date);
    }
    if (a.updated_date) return -1;
    if (b.updated_date) return 1;

    // Earliest creation first
    if (a.created_date && b.created_date) {
      return new Date(a.created_date) - new Date(b.created_date);
    }
    if (a.created_date) return -1;
    if (b.created_date) return 1;

    // Stable sort by id
    return (a.id || '').localeCompare(b.id || '');
  });

  return sorted[0];
}