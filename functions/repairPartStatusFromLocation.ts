import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only function
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all parts
    const parts = await base44.asServiceRole.entities.Part.list();

    // Location to status mapping
    const locationToStatus = {
      'warehouse_storage': 'in_storage',
      'vehicle': 'in_vehicle',
      'client_site': 'installed',
      'loading_bay': 'in_loading_bay',
      'supplier': 'on_order'
    };

    // Normalize location helper
    const normalizeLocation = (location) => {
      if (!location) return null;
      const normalized = location.toLowerCase().replace(/\s+/g, '_');
      
      if (normalized.includes("supplier") || normalized === "on_order") {
        return 'supplier';
      }
      if (normalized.includes("delivery_bay") || normalized.includes("loading_bay") || normalized.includes("delivery") || normalized.includes("at_delivery")) {
        return 'loading_bay';
      }
      if (normalized.includes("warehouse") || normalized.includes("storage")) {
        return 'warehouse_storage';
      }
      if (normalized.includes("technician") || normalized.includes("vehicle")) {
        return 'vehicle';
      }
      if (normalized.includes("client") || normalized.includes("site")) {
        return 'client_site';
      }
      
      return null;
    };

    // Find mismatches
    const mismatches = [];
    for (const part of parts) {
      if (!part.location) continue;
      
      const normalizedLocation = normalizeLocation(part.location);
      if (!normalizedLocation) continue;
      
      const expectedStatus = locationToStatus[normalizedLocation];
      if (!expectedStatus) continue;
      
      const currentStatus = part.status?.toLowerCase().trim().replace(/\s+/g, '_');
      
      if (currentStatus !== expectedStatus) {
        mismatches.push({
          id: part.id,
          item_name: part.item_name,
          location: part.location,
          current_status: part.status,
          expected_status: expectedStatus
        });
      }
    }

    // Update mismatched parts
    const updates = [];
    for (const mismatch of mismatches) {
      try {
        await base44.asServiceRole.entities.Part.update(mismatch.id, {
          status: mismatch.expected_status
        });
        updates.push({
          ...mismatch,
          updated: true
        });
      } catch (error) {
        updates.push({
          ...mismatch,
          updated: false,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total_parts: parts.length,
      mismatches_found: mismatches.length,
      updates_applied: updates.filter(u => u.updated).length,
      updates_failed: updates.filter(u => !u.updated).length,
      details: updates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});