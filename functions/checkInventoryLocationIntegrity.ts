import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Inventory Location Integrity Check
 * Validates the completeness and consistency of the inventory location setup.
 * Does NOT mutate data - read-only validation.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin-only
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Fetch all data
        const [locations, vehicles, stockMovements] = await Promise.all([
            base44.asServiceRole.entities.InventoryLocation.list(),
            base44.asServiceRole.entities.Vehicle.list(),
            base44.asServiceRole.entities.StockMovement.list('-created_date', 100) // Sample recent movements
        ]);

        const result = {
            status: 'PASS',
            missing_locations: [],
            duplicate_locations: [],
            orphaned_vehicle_locations: [],
            inactive_locations_in_use: [],
            summary: {}
        };

        // 1. Check for LOADING_BAY (exactly one)
        const loadingBayLocs = locations.filter(loc => 
            loc.location_code === 'LOADING_BAY' && 
            loc.location_type === 'loading_bay' && 
            loc.is_active === true
        );
        if (loadingBayLocs.length === 0) {
            result.status = 'FAIL';
            result.missing_locations.push({
                location_code: 'LOADING_BAY',
                location_type: 'loading_bay',
                reason: 'Required location missing'
            });
        } else if (loadingBayLocs.length > 1) {
            result.status = 'FAIL';
            result.duplicate_locations.push({
                location_code: 'LOADING_BAY',
                count: loadingBayLocs.length,
                ids: loadingBayLocs.map(l => l.id)
            });
        }

        // 2. Check for CONSUMED (exactly one)
        const consumedLocs = locations.filter(loc => 
            loc.location_code === 'CONSUMED' && 
            loc.location_type === 'virtual' && 
            loc.is_active === true
        );
        if (consumedLocs.length === 0) {
            result.status = 'FAIL';
            result.missing_locations.push({
                location_code: 'CONSUMED',
                location_type: 'virtual',
                reason: 'Required virtual location missing'
            });
        } else if (consumedLocs.length > 1) {
            result.status = 'FAIL';
            result.duplicate_locations.push({
                location_code: 'CONSUMED',
                count: consumedLocs.length,
                ids: consumedLocs.map(l => l.id)
            });
        }

        // 3. Check for at least one warehouse
        const warehouseLocs = locations.filter(loc => 
            loc.location_type === 'warehouse' && 
            loc.is_active === true
        );
        if (warehouseLocs.length === 0) {
            result.status = 'FAIL';
            result.missing_locations.push({
                location_type: 'warehouse',
                reason: 'At least one active warehouse location required'
            });
        }

        // 4. Check vehicle locations
        const vehicleLocs = locations.filter(loc => loc.location_type === 'vehicle');
        const vehicleLocsByVehicleId = {};
        vehicleLocs.forEach(loc => {
            if (loc.vehicle_id) {
                if (!vehicleLocsByVehicleId[loc.vehicle_id]) {
                    vehicleLocsByVehicleId[loc.vehicle_id] = [];
                }
                vehicleLocsByVehicleId[loc.vehicle_id].push(loc);
            }
        });

        // Check each vehicle has exactly one active location
        vehicles.forEach(vehicle => {
            const vehicleLocations = vehicleLocsByVehicleId[vehicle.id] || [];
            const activeVehicleLocations = vehicleLocations.filter(loc => loc.is_active === true);
            
            if (activeVehicleLocations.length === 0) {
                result.status = 'FAIL';
                result.missing_locations.push({
                    vehicle_id: vehicle.id,
                    vehicle_name: vehicle.name,
                    reason: 'Vehicle missing active inventory location'
                });
            } else if (activeVehicleLocations.length > 1) {
                result.status = 'FAIL';
                result.duplicate_locations.push({
                    vehicle_id: vehicle.id,
                    vehicle_name: vehicle.name,
                    count: activeVehicleLocations.length,
                    ids: activeVehicleLocations.map(l => l.id)
                });
            }
        });

        // Check for orphaned vehicle locations (vehicle_id references non-existent vehicle)
        const vehicleIds = new Set(vehicles.map(v => v.id));
        vehicleLocs.forEach(loc => {
            if (loc.vehicle_id && !vehicleIds.has(loc.vehicle_id)) {
                result.status = 'FAIL';
                result.orphaned_vehicle_locations.push({
                    location_id: loc.id,
                    location_code: loc.location_code,
                    vehicle_id: loc.vehicle_id,
                    reason: 'References non-existent vehicle'
                });
            }
        });

        // 5. Check for duplicate location_code values
        const locationCodeCounts = {};
        locations.filter(loc => loc.is_active === true).forEach(loc => {
            if (loc.location_code) {
                locationCodeCounts[loc.location_code] = (locationCodeCounts[loc.location_code] || 0) + 1;
            }
        });
        Object.entries(locationCodeCounts).forEach(([code, count]) => {
            if (count > 1 && !result.duplicate_locations.find(d => d.location_code === code)) {
                result.status = 'FAIL';
                result.duplicate_locations.push({
                    location_code: code,
                    count,
                    reason: 'Duplicate location_code'
                });
            }
        });

        // 6. Check for inactive locations being referenced in recent stock movements
        const activeLocationIds = new Set(locations.filter(loc => loc.is_active === true).map(l => l.id));
        const inactiveInUse = new Set();
        
        stockMovements.forEach(movement => {
            if (movement.from_location_id && !activeLocationIds.has(movement.from_location_id)) {
                const loc = locations.find(l => l.id === movement.from_location_id);
                if (loc) {
                    inactiveInUse.add(JSON.stringify({
                        location_id: loc.id,
                        location_code: loc.location_code,
                        location_type: loc.location_type
                    }));
                }
            }
            if (movement.to_location_id && !activeLocationIds.has(movement.to_location_id)) {
                const loc = locations.find(l => l.id === movement.to_location_id);
                if (loc) {
                    inactiveInUse.add(JSON.stringify({
                        location_id: loc.id,
                        location_code: loc.location_code,
                        location_type: loc.location_type
                    }));
                }
            }
        });

        if (inactiveInUse.size > 0) {
            result.status = 'FAIL';
            result.inactive_locations_in_use = Array.from(inactiveInUse).map(s => JSON.parse(s));
        }

        // Summary stats
        result.summary = {
            total_locations: locations.length,
            active_locations: locations.filter(l => l.is_active === true).length,
            loading_bay_count: loadingBayLocs.length,
            consumed_count: consumedLocs.length,
            warehouse_count: warehouseLocs.length,
            vehicle_location_count: vehicleLocs.filter(l => l.is_active === true).length,
            total_vehicles: vehicles.length
        };

        return Response.json(result);

    } catch (error) {
        console.error('[checkInventoryLocationIntegrity] Error:', error);
        return Response.json({ 
            error: error.message,
            status: 'ERROR'
        }, { status: 500 });
    }
});