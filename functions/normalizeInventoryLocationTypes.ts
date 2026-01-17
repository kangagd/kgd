import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SAFE ONE-TIME NORMALIZATION FUNCTION
 * 
 * Normalizes all InventoryLocation.type values to lowercase canonical forms:
 * "Warehouse" → "warehouse", "Vehicle" → "vehicle", "WAREHOUSE" → "warehouse", etc.
 * 
 * ADMIN-ONLY: This function enforces strict admin access.
 * 
 * Call once if needed; safe to run multiple times (idempotent).
 * Does NOT delete or modify any other fields.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY enforcement
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }

    // Fetch all locations
    const allLocations = await base44.asServiceRole.entities.InventoryLocation.filter({});

    if (allLocations.length === 0) {
      return Response.json({
        success: true,
        message: 'No locations to normalize',
        normalized: 0
      });
    }

    // Normalize types: "Warehouse" → "warehouse", etc.
    let normalizedCount = 0;
    const updates = [];

    for (const loc of allLocations) {
      const current = loc.type || 'other';
      const normalized = normalizeType(current);

      if (normalized !== current) {
        updates.push({ id: loc.id, type: normalized });
        normalizedCount++;
      }
    }

    // Apply updates
    for (const update of updates) {
      await base44.asServiceRole.entities.InventoryLocation.update(update.id, {
        type: update.type
      });
    }

    return Response.json({
      success: true,
      message: `Normalized ${normalizedCount} location type(s)`,
      normalized: normalizedCount,
      total: allLocations.length
    });

  } catch (error) {
    console.error('[normalizeInventoryLocationTypes] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Normalize a single type value to canonical lowercase
 * @private
 */
function normalizeType(type) {
  if (!type) return 'other';
  const lower = String(type).toLowerCase().trim();
  if (lower === 'warehouse') return 'warehouse';
  // Map common vehicle synonyms to 'vehicle'
  if (['vehicle', 'van', 'car', 'truck', 'mobile'].includes(lower)) return 'vehicle';
  return 'other';
}