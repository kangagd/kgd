import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id required' }, { status: 400 });
    }

    // Get job with assigned technician
    const job = await base44.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get all LineItems for this job
    const lineItems = await base44.entities.LineItem.filter({ job_id });
    if (lineItems.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No items to deduct',
        deducted: [] 
      });
    }

    // Get primary assigned technician email
    const technicianEmail = job.assigned_to?.[0];
    if (!technicianEmail) {
      return Response.json({ 
        error: 'No technician assigned to this job' 
      }, { status: 400 });
    }

    // Find technician's vehicle (assigned vehicle in InventoryLocation)
    const vehicleLocations = await base44.entities.InventoryLocation.filter({
      type: 'vehicle',
      assigned_technician_email: technicianEmail
    });

    if (vehicleLocations.length === 0) {
      return Response.json({ 
        error: 'No vehicle assigned to this technician' 
      }, { status: 400 });
    }

    const vehicleLocation = vehicleLocations[0];

    // Verify vehicle still exists and technician is still assigned
    const vehicle = await base44.entities.Vehicle.get(vehicleLocation.vehicle_id);
    if (!vehicle || vehicle.assigned_user_id !== job.assigned_to?.[0]) {
      return Response.json({ 
        error: 'Vehicle assignment mismatch or technician reassigned' 
      }, { status: 400 });
    }
    const deducted = [];

    // For each line item, decrement from vehicle inventory via canonical backend
    for (const lineItem of lineItems) {
      try {
        // Call canonical recordStockMovement function (NEW SCHEMA)
        // This handles InventoryQuantity updates + StockMovement audit ledger
        const response = await base44.asServiceRole.functions.invoke('recordStockMovement', {
          priceListItemId: lineItem.price_list_item_id,
          fromLocationId: vehicleLocation.id,
          toLocationId: null, // Stock out (no destination)
          quantity: lineItem.quantity,
          movementType: 'job_usage',
          jobId: job_id,
          notes: `Used on job #${job.job_number}`
        });

        if (response.data.error) {
          console.error(`Error deducting item ${lineItem.item_name}:`, response.data.error);
          continue;
        }

        deducted.push({
          item_name: lineItem.item_name,
          quantity: lineItem.quantity,
          status: 'deducted'
        });
      } catch (itemError) {
        console.error(`Error deducting item ${lineItem.item_name}:`, itemError);
        // Continue with other items
      }
    }

    return Response.json({
      success: true,
      message: `Deducted ${deducted.length} items from ${vehicleLocation.name}`,
      vehicle: vehicleLocation.name,
      technician: technicianEmail,
      deducted
    });
  } catch (error) {
    console.error('Error in autoDeductJobUsage:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});