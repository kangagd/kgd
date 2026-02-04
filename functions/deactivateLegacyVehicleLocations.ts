import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Safely deactivate legacy vehicle InventoryLocation records that:
 * - Represent vehicles (type = "vehicle")
 * - Are not linked to a Vehicle entity (vehicle_id IS NULL)
 * - Are superseded by canonical vehicle locations
 * 
 * SAFETY:
 * - Does NOT delete any records
 * - Does NOT modify StockMovement history
 * - Only sets is_active = false on confirmed legacy locations
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

    // Step 1: Fetch canonical vehicle locations
    const canonicalLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'vehicle',
      vehicle_id: { $exists: true, $ne: null },
      is_active: true
    });

    // Build lookup map by normalized vehicle name
    const canonicalMap = new Map();
    for (const loc of canonicalLocations) {
      const normalized = normalizeVehicleName(loc.name || '');
      if (normalized) {
        canonicalMap.set(normalized, {
          id: loc.id,
          name: loc.name,
          vehicle_id: loc.vehicle_id,
          location_code: loc.location_code
        });
      }
    }

    // Step 2: Fetch active legacy vehicle locations
    const legacyLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'vehicle',
      vehicle_id: { $exists: false },
      is_active: true
    });

    const deactivated = [];
    const skipped = [];

    // Step 3 & 4: Match legacy → canonical and deactivate
    for (const legacy of legacyLocations) {
      const normalizedName = normalizeVehicleName(legacy.name || '');
      
      if (!normalizedName) {
        skipped.push({
          id: legacy.id,
          name: legacy.name,
          reason: 'Could not normalize name'
        });
        continue;
      }

      const canonical = canonicalMap.get(normalizedName);
      
      if (!canonical) {
        skipped.push({
          id: legacy.id,
          name: legacy.name,
          reason: 'No canonical vehicle match found'
        });
        continue;
      }

      // Deactivate legacy location with audit trail
      const updatedDescription = [
        legacy.description || '',
        `[Auto-retired ${new Date().toISOString().split('T')[0]}] Superseded by canonical vehicle-linked location (vehicle_id: ${canonical.vehicle_id}).`
      ].join('\n').trim();

      await base44.asServiceRole.entities.InventoryLocation.update(legacy.id, {
        is_active: false,
        description: updatedDescription
      });

      deactivated.push({
        id: legacy.id,
        name: legacy.name,
        superseded_by_vehicle_id: canonical.vehicle_id,
        superseded_by_location_id: canonical.id
      });
    }

    return Response.json({
      status: 'SUCCESS',
      summary: `Deactivated ${deactivated.length} legacy vehicle locations, preserved ${canonicalLocations.length} canonical locations`,
      deactivated_legacy_locations: deactivated,
      skipped_locations: skipped,
      canonical_vehicle_locations_preserved: canonicalLocations.length
    });

  } catch (error) {
    console.error('deactivateLegacyVehicleLocations error:', error);
    return Response.json({ 
      error: error.message,
      status: 'ERROR'
    }, { status: 500 });
  }
});

/**
 * Normalize vehicle name for matching
 * Strips common prefixes and variations
 */
function normalizeVehicleName(name) {
  if (!name) return '';
  
  let normalized = name.toLowerCase().trim();
  
  // Strip common prefixes
  normalized = normalized.replace(/^vehicle:\s*/i, '');
  normalized = normalized.replace(/^vehicle\s+/i, '');
  normalized = normalized.replace(/^veh:\s*/i, '');
  
  // Strip punctuation and extra spaces
  normalized = normalized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  return normalized;
}