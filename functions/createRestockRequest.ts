import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { vehicle_id, items, notes } = await req.json();

        const vehicle = await base44.entities.Vehicle.get(vehicle_id);
        if (!vehicle) throw new Error("Vehicle not found");

        // Construct description of requested items
        let description = `Restock Request for ${vehicle.name}\n\nRequested Items:\n`;
        items.forEach(item => {
            description += `- ${item.product_name}: ${item.quantity} (Current: ${item.current_quantity}, Min: ${item.min_quantity})\n`;
        });

        if (notes) {
            description += `\nNotes:\n${notes}`;
        }

        // Search for a "Logistics" job type or default
        const jobTypes = await base44.entities.JobType.filter({ name: 'Logistics' });
        const logisticsTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;

        // Create Job
        // We'll assign it to Admins or leave unassigned
        const newJob = await base44.entities.Job.create({
            customer_id: user.id, // Using requesting user as "customer" for internal job, or maybe an internal customer "KGD Internal"
            customer_name: "Internal - Restock Request",
            job_type_id: logisticsTypeId,
            job_type_name: "Logistics - Restock",
            status: "Open",
            overview: description,
            vehicle_id: vehicle_id,
            assigned_to: [], // Unassigned initially
            notes: `Requested by ${user.full_name || user.email}`,
            address_full: "Warehouse / Office",
            scheduled_date: new Date().toISOString().split('T')[0] // Today
        });

        return Response.json({ success: true, job: newJob });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});