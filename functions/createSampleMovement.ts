import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const {
      sample_id,
      movement_type,
      from_location_type,
      from_location_reference_id,
      to_location_type,
      to_location_reference_id,
      notes,
    } = await req.json();

    // Create the movement record
    const movement = await base44.entities.SampleMovement.create({
      sample_id,
      movement_type,
      from_location_type,
      from_location_reference_id: from_location_reference_id || null,
      to_location_type,
      to_location_reference_id: to_location_reference_id || null,
      actor_user_id: user.id,
      notes: notes || null,
    });

    return Response.json({
      success: true,
      movement
    });
  } catch (error) {
    console.error("Error creating sample movement:", error);
    return Response.json({ 
      success: false, 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
});