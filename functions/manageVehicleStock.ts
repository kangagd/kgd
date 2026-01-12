import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, data } = await req.json();

        // data fields: vehicle_id, product_id, quantity, job_id, reason, new_quantity
        
        // Verify vehicle access for technicians
        if (user.role !== 'admin' && user.role !== 'manager') {
            if (action !== 'consume' && action !== 'restock_request' && action !== 'adjust') {
                 // Technicians can consume, request restock (handled elsewhere usually but maybe logic here), adjust
                 // But strictly speaking, technicians can only touch their OWN vehicle
                 const vehicle = await base44.entities.Vehicle.get(data.vehicle_id);
                 if (!vehicle || vehicle.assigned_user_id !== user.id) {
                     return Response.json({ error: 'Unauthorized access to vehicle' }, { status: 403 });
                 }
            }
        }

        if (action === 'consume') {
            // Mark used on job - now uses moveInventory instead of manageVehicleStock
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
        }

        if (action === 'adjust') {
            // Manual adjustment - now uses moveInventory instead of manageVehicleStock
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
        }

        if (action === 'restock') {
            // Admin restocking vehicle - now uses moveInventory instead of manageVehicleStock
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
        }

        if (action === 'create_product_and_add') {
            // Create product and add to vehicle - now uses moveInventory instead
            // This action is deprecated - use moveInventory function directly
            return Response.json({ error: 'Use moveInventory function instead' }, { status: 400 });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});