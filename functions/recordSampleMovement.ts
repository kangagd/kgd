import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Sample Movement Types
const SAMPLE_MOVEMENT_TYPE = {
  CHECK_OUT_TO_VEHICLE: "Check Out to Vehicle",
  DROP_AT_CLIENT: "Drop at Client",
  PICK_UP_FROM_CLIENT: "Pick Up from Client",
  RETURN_TO_WAREHOUSE: "Return to Warehouse",
  REASSIGN_VEHICLE: "Reassign Vehicle",
};

// Sample Location Types
const SAMPLE_LOCATION_TYPE = {
  WAREHOUSE: "Warehouse",
  VEHICLE: "Vehicle",
  WITH_CLIENT: "With Client",
  IN_TRANSIT_DROP_OFF: "In Transit (Drop-Off)",
  IN_TRANSIT_PICKUP: "In Transit (Pickup)",
  LOST: "Lost",
};

/**
 * Helper: Move samples to vehicle
 */
export async function moveSampleToVehicle(base44, sample_ids, vehicle_id, technician_id = null) {
  return await recordSampleMovement(base44, {
    sample_ids,
    to_location_type: SAMPLE_LOCATION_TYPE.VEHICLE,
    to_location_reference_id: vehicle_id,
    movement_type: SAMPLE_MOVEMENT_TYPE.CHECK_OUT_TO_VEHICLE,
    technician_id,
  });
}

/**
 * Helper: Move samples to warehouse
 */
export async function moveSampleToWarehouse(base44, sample_ids, technician_id = null) {
  return await recordSampleMovement(base44, {
    sample_ids,
    to_location_type: SAMPLE_LOCATION_TYPE.WAREHOUSE,
    to_location_reference_id: null,
    movement_type: SAMPLE_MOVEMENT_TYPE.RETURN_TO_WAREHOUSE,
    technician_id,
  });
}

/**
 * Helper: Move samples to client
 */
export async function moveSampleToClient(base44, sample_ids, project_id, technician_id = null, linked_job_id = null) {
  return await recordSampleMovement(base44, {
    sample_ids,
    to_location_type: SAMPLE_LOCATION_TYPE.WITH_CLIENT,
    to_location_reference_id: project_id,
    movement_type: SAMPLE_MOVEMENT_TYPE.DROP_AT_CLIENT,
    technician_id,
    linked_job_id,
  });
}

/**
 * Helper: Move samples from client to vehicle
 */
export async function moveSampleFromClientToVehicle(base44, sample_ids, vehicle_id, technician_id = null, linked_job_id = null) {
  return await recordSampleMovement(base44, {
    sample_ids,
    to_location_type: SAMPLE_LOCATION_TYPE.VEHICLE,
    to_location_reference_id: vehicle_id,
    movement_type: SAMPLE_MOVEMENT_TYPE.PICK_UP_FROM_CLIENT,
    technician_id,
    linked_job_id,
  });
}

/**
 * Main function: Record sample movement(s)
 */
async function recordSampleMovement(base44, payload) {
  const {
    sample_ids,
    from_location_type,
    from_location_reference_id,
    to_location_type,
    to_location_reference_id,
    movement_type,
    technician_id,
    linked_job_id,
    notes,
  } = payload;

  // Validate required fields
  if (!sample_ids || !Array.isArray(sample_ids) || sample_ids.length === 0) {
    return {
      success: false,
      error: "sample_ids is required and must be a non-empty array"
    };
  }

  if (!to_location_type) {
    return {
      success: false,
      error: "to_location_type is required"
    };
  }

  if (!movement_type) {
    return {
      success: false,
      error: "movement_type is required"
    };
  }

  const updatedSamples = [];
  const movements = [];

  try {
    // Process each sample
    for (const sample_id of sample_ids) {
      // Fetch current sample
      const sample = await base44.asServiceRole.entities.Sample.get(sample_id);
      
      if (!sample) {
        return {
          success: false,
          error: `Sample with id ${sample_id} not found`
        };
      }

      // Determine from_location
      const actualFromLocationType = from_location_type || sample.location_type;
      const actualFromLocationRefId = from_location_reference_id !== undefined 
        ? from_location_reference_id 
        : sample.location_reference_id;

      // Create movement record
      const movement = await base44.asServiceRole.entities.SampleMovement.create({
        sample_id,
        from_location_type: actualFromLocationType,
        from_location_reference_id: actualFromLocationRefId,
        to_location_type,
        to_location_reference_id,
        movement_type,
        technician_id,
        linked_job_id,
        notes,
      });

      movements.push(movement);

      // Update sample location
      const updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, {
        location_type: to_location_type,
        location_reference_id: to_location_reference_id,
      });

      updatedSamples.push(updatedSample);
    }

    return {
      success: true,
      updatedSamples,
      movements,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to record sample movement"
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const result = await recordSampleMovement(base44, payload);

    if (!result.success) {
      return Response.json(result, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
});