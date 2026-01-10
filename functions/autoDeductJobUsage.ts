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

    // For each line item, decrement from vehicle inventory
    for (const lineItem of lineItems) {
      try {
        // Get current quantity in vehicle
        const existingQty = await base44.entities.InventoryQuantity.filter({
          location_id: vehicleLocation.id,
          price_list_item_id: lineItem.price_list_item_id
        });

        const currentQty = existingQty[0]?.quantity || 0;
        const newQty = Math.max(0, currentQty - lineItem.quantity);

        // Update quantity
        if (existingQty.length > 0) {
          await base44.asServiceRole.entities.InventoryQuantity.update(
            existingQty[0].id,
            { quantity: newQty }
          );
        } else {
          // Create new quantity record if it doesn't exist
          await base44.asServiceRole.entities.InventoryQuantity.create({
            location_id: vehicleLocation.id,
            price_list_item_id: lineItem.price_list_item_id,
            item_name: lineItem.item_name,
            location_name: vehicleLocation.name,
            quantity: Math.max(0, -lineItem.quantity)
          });
        }

        // Record movement
        await base44.asServiceRole.entities.StockMovement.create({
          item_name: lineItem.item_name,
          price_list_item_id: lineItem.price_list_item_id,
          movement_type: 'job_usage',
          quantity: lineItem.quantity,
          from_location_id: vehicleLocation.id,
          from_location_name: vehicleLocation.name,
          moved_by: user.email,
          moved_by_name: user.full_name,
          job_id,
          notes: `Used on job #${job.job_number}`
        });

        deducted.push({
          item_name: lineItem.item_name,
          quantity: lineItem.quantity,
          previous_stock: currentQty,
          new_stock: newQty
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