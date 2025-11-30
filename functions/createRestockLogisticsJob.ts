import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { requestId } = await req.json();
    
    // Get request details
    const request = await base44.asServiceRole.entities.RestockRequest.get(requestId);
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });

    const vehicle = await base44.asServiceRole.entities.Vehicle.get(request.vehicle_id);
    const part = await base44.asServiceRole.entities.PriceListItem.get(request.part_id); // Assuming Part/PriceList link

    // Create Logistics Job
    const jobTypeName = "Delivery – To Client"; // Using this as 'Delivery to Technician' effectively
    // Or create a specific 'Restock Delivery' type
    
    // Check/Create JobType
    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: "Internal Restock" });
    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
    if (!jobTypeId) {
        const newType = await base44.asServiceRole.entities.JobType.create({
            name: "Internal Restock",
            description: "Logistics: Restock delivery to vehicle",
            color: "#10b981",
            estimated_duration: 1,
            is_active: true
        });
        jobTypeId = newType.id;
    }

    // Create Job
    const newJob = await base44.asServiceRole.entities.Job.create({
        job_category: "Logistics",
        logistics_type: "Delivery – To Client",
        job_type: "Internal Restock",
        job_type_id: jobTypeId,
        job_type_name: "Internal Restock",
        customer_id: vehicle.assigned_to || "unknown_customer", 
        customer_name: "Internal Operations", 
        status: "Open",
        address: vehicle.primary_location || "Technician Location",
        address_full: vehicle.primary_location || "Technician Location",
        notes: `Restock request for ${request.part_name} (Qty: ${request.requested_quantity}) - Vehicle: ${vehicle.name}`,
        assigned_to: [request.technician_id]
    });

    // Notify Technician
    await base44.asServiceRole.functions.invoke('createNotification', {
        userId: request.technician_id,
        title: "Restock Job Created",
        message: `A restock delivery job has been created for your request of ${request.part_name}.`,
        entityType: "Job",
        entityId: newJob.id,
        priority: "normal"
    });

    // Update request with link
    await base44.asServiceRole.entities.RestockRequest.update(requestId, {
        logistics_job_id: newJob.id,
        status: "Approved"
    });

    return Response.json({ success: true, job: newJob });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});