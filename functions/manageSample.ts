import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validateSampleMutation } from './validateSampleMutation.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, sample_id } = payload;

    if (!action) {
      return Response.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    if (!sample_id) {
      return Response.json({ success: false, error: 'sample_id is required' }, { status: 400 });
    }

    // Load the sample
    const sample = await base44.asServiceRole.entities.Sample.get(sample_id);
    if (!sample) {
      return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
    }

    let updatedSample;
    let movementType;
    let fromLocationType = sample.current_location_type;
    let fromLocationReferenceId = sample.current_location_reference_id;
    let toLocationType;
    let toLocationReferenceId;
    const notes = payload.notes || null;

    console.log(`manageSample: action=${action}, sample_id=${sample_id}`);

    switch (action) {
      case 'checkoutToProject': {
        const { project_id, due_back_at } = payload;
        
        if (!project_id) {
          return Response.json({ success: false, error: 'project_id is required' }, { status: 400 });
        }

        if (sample.status !== 'active') {
          return Response.json({ 
            success: false, 
            error: `Cannot checkout sample with status '${sample.status}'. Only active samples can be checked out.` 
          }, { status: 400 });
        }

        toLocationType = 'project';
        toLocationReferenceId = project_id;

        const updateData = {
          current_location_type: 'project',
          current_location_reference_id: project_id,
          checked_out_project_id: project_id,
          checked_out_by_user_id: user.id,
          checked_out_at: new Date().toISOString(),
          due_back_at: due_back_at || null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleMutation({ sample: { ...sample, ...updateData } });

        updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, updateData);
        movementType = 'checkout';

        console.log(`checkoutToProject: sample_id=${sample_id}, project_id=${project_id}, movement_type=${movementType}`);
        break;
      }

      case 'returnSample': {
        const { return_to, vehicle_id } = payload;
        
        let destinationType;
        let destinationReferenceId = null;

        if (return_to === 'warehouse') {
          destinationType = 'warehouse';
        } else if (return_to === 'vehicle') {
          if (!vehicle_id) {
            return Response.json({ success: false, error: 'vehicle_id is required when return_to=vehicle' }, { status: 400 });
          }
          destinationType = 'vehicle';
          destinationReferenceId = vehicle_id;
        } else {
          // Default: return to home
          destinationType = sample.home_location_type;
          destinationReferenceId = sample.home_location_type === 'vehicle' ? sample.home_location_reference_id : null;
        }

        toLocationType = destinationType;
        toLocationReferenceId = destinationReferenceId;

        const updateData = {
          current_location_type: destinationType,
          current_location_reference_id: destinationReferenceId,
          checked_out_project_id: null,
          checked_out_by_user_id: null,
          checked_out_at: null,
          due_back_at: null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleMutation({ sample: { ...sample, ...updateData } });

        updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, updateData);
        movementType = 'return';

        console.log(`returnSample: sample_id=${sample_id}, to=${destinationType}, movement_type=${movementType}`);
        break;
      }

      case 'transferToVehicle': {
        const { vehicle_id } = payload;
        
        if (!vehicle_id) {
          return Response.json({ success: false, error: 'vehicle_id is required' }, { status: 400 });
        }

        toLocationType = 'vehicle';
        toLocationReferenceId = vehicle_id;

        const updateData = {
          current_location_type: 'vehicle',
          current_location_reference_id: vehicle_id,
          checked_out_project_id: null,
          checked_out_by_user_id: null,
          checked_out_at: null,
          due_back_at: null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleMutation({ sample: { ...sample, ...updateData } });

        updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, updateData);
        movementType = 'transfer';

        console.log(`transferToVehicle: sample_id=${sample_id}, vehicle_id=${vehicle_id}, movement_type=${movementType}`);
        break;
      }

      case 'markLost': {
        toLocationType = 'unknown';
        toLocationReferenceId = null;

        const updateData = {
          status: 'lost',
          current_location_type: 'unknown',
          current_location_reference_id: null,
          checked_out_project_id: null,
          checked_out_by_user_id: null,
          checked_out_at: null,
          due_back_at: null,
        };

        validateSampleMutation({ sample: { ...sample, ...updateData } });

        updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, updateData);
        movementType = 'mark_lost';

        console.log(`markLost: sample_id=${sample_id}, movement_type=${movementType}`);
        break;
      }

      case 'markFound': {
        const { found_location_type, vehicle_id } = payload;
        
        if (!found_location_type || !['warehouse', 'vehicle'].includes(found_location_type)) {
          return Response.json({ 
            success: false, 
            error: 'found_location_type is required and must be warehouse or vehicle' 
          }, { status: 400 });
        }

        if (found_location_type === 'vehicle' && !vehicle_id) {
          return Response.json({ success: false, error: 'vehicle_id is required when found_location_type=vehicle' }, { status: 400 });
        }

        toLocationType = found_location_type;
        toLocationReferenceId = found_location_type === 'vehicle' ? vehicle_id : null;

        const updateData = {
          status: 'active',
          current_location_type: found_location_type,
          current_location_reference_id: toLocationReferenceId,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleMutation({ sample: { ...sample, ...updateData } });

        updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, updateData);
        movementType = 'mark_found';

        console.log(`markFound: sample_id=${sample_id}, found_at=${found_location_type}, movement_type=${movementType}`);
        break;
      }

      case 'retireSample': {
        toLocationType = sample.current_location_type;
        toLocationReferenceId = sample.current_location_reference_id;

        const updateData = {
          status: 'retired',
          checked_out_project_id: null,
          checked_out_by_user_id: null,
          checked_out_at: null,
          due_back_at: null,
        };

        validateSampleMutation({ sample: { ...sample, ...updateData } });

        updatedSample = await base44.asServiceRole.entities.Sample.update(sample_id, updateData);
        movementType = 'retire';

        console.log(`retireSample: sample_id=${sample_id}, movement_type=${movementType}`);
        break;
      }

      default:
        return Response.json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

    // Create SampleMovement record
    const movement = await base44.asServiceRole.entities.SampleMovement.create({
      sample_id,
      movement_type: movementType,
      from_location_type: fromLocationType,
      from_location_reference_id: fromLocationReferenceId || null,
      to_location_type: toLocationType,
      to_location_reference_id: toLocationReferenceId || null,
      actor_user_id: user.id,
      notes,
    });

    return Response.json({
      success: true,
      sample: updatedSample,
      movement,
    });

  } catch (error) {
    console.error("Error in manageSample:", error);
    return Response.json({ 
      success: false, 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
});