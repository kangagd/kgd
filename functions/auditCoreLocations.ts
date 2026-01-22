import { createClientFromRequest } from './shared/sdk.js';
import { LOCATION_TYPES } from './shared/locationResolver.js';

/**
 * Admin-only audit: Check existence of required core InventoryLocations
 * Returns { ok: true } or { ok: false, missing: [...] }
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ADMIN-ONLY
        if (user.role !== 'admin') {
            return Response.json({
                error: 'Forbidden: Admin access required',
                ok: false
            }, { status: 403 });
        }

        const locations = await base44.asServiceRole.entities.InventoryLocation.list();
        const missing = [];

        // Check for active loading_bay
        const hasLoadingBay = locations.some(
            loc => loc.type === LOCATION_TYPES.LOADING_BAY && loc.is_active !== false
        );
        if (!hasLoadingBay) {
            missing.push(LOCATION_TYPES.LOADING_BAY);
        }

        // Check for active warehouse
        const hasWarehouse = locations.some(
            loc => loc.type === LOCATION_TYPES.WAREHOUSE && loc.is_active !== false
        );
        if (!hasWarehouse) {
            missing.push(LOCATION_TYPES.WAREHOUSE);
        }

        if (missing.length === 0) {
            return Response.json({ ok: true });
        }

        return Response.json({
            ok: false,
            missing,
            total_locations: locations.length,
            message: `Missing active locations: ${missing.join(', ')}`
        });
    } catch (error) {
        console.error('[auditCoreLocations] Error:', error);
        return Response.json({
            error: error.message,
            ok: false
        }, { status: 500 });
    }
});