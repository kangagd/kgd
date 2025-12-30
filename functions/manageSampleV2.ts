import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action } = payload;

    if (!action) {
      return Response.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    // Helper function to validate sample entity before update
    const validateSampleData = (data) => {
      // Rule 1: If current_location_type = warehouse → current_location_reference_id must be null
      if (data.current_location_type === 'warehouse' && data.current_location_reference_id !== null) {
        throw new Error('current_location_reference_id must be null when current_location_type is warehouse');
      }

      // Rule 2: If checked_out_project_id is set → must be in project location
      if (data.checked_out_project_id) {
        if (data.current_location_type !== 'project') {
          throw new Error('current_location_type must be project when checked_out_project_id is set');
        }
        if (data.current_location_reference_id !== data.checked_out_project_id) {
          throw new Error('current_location_reference_id must equal checked_out_project_id');
        }
      }

      // Rule 3: If status = retired → all checked_out fields must be null
      if (data.status === 'retired') {
        if (data.checked_out_project_id || data.checked_out_by_user_id || data.checked_out_at || data.due_back_at) {
          throw new Error('All checked_out fields must be null when status is retired');
        }
      }
    };

    // Helper function to create movement record
    const createMovement = async (sample, movementType, fromLocType, fromLocRef, toLocType, toLocRef, notes) => {
      await base44.asServiceRole.entities.SampleMovementV2.create({
        sample_id: sample.id,
        movement_type: movementType,
        from_location_type: fromLocType || null,
        from_location_reference_id: fromLocRef || null,
        to_location_type: toLocType,
        to_location_reference_id: toLocRef || null,
        actor_user_id: user.id,
        notes: notes || null,
      });
    };

    switch (action) {
      case 'createSample': {
        const { data } = payload;
        if (!data || !data.name) {
          return Response.json({ success: false, error: 'data.name is required' }, { status: 400 });
        }

        const sampleData = {
          ...data,
          status: data.status || 'active',
          current_location_type: data.current_location_type || 'warehouse',
          current_location_reference_id: data.current_location_type === 'warehouse' ? null : data.current_location_reference_id,
          home_location_type: data.home_location_type || 'warehouse',
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData(sampleData);

        const sample = await base44.asServiceRole.entities.SampleV2.create(sampleData);
        return Response.json({ success: true, sample });
      }

      case 'checkoutToProject': {
        const { sample_id, project_id, due_back_at, notes } = payload;
        
        if (!sample_id || !project_id) {
          return Response.json({ success: false, error: 'sample_id and project_id are required' }, { status: 400 });
        }

        const sample = await base44.asServiceRole.entities.SampleV2.get(sample_id);
        if (!sample) {
          return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
        }

        if (sample.status === 'retired') {
          return Response.json({ success: false, error: 'Cannot checkout retired sample' }, { status: 400 });
        }

        const fromLocType = sample.current_location_type;
        const fromLocRef = sample.current_location_reference_id;

        const updatedData = {
          current_location_type: 'project',
          current_location_reference_id: project_id,
          checked_out_project_id: project_id,
          checked_out_by_user_id: user.id,
          checked_out_at: new Date().toISOString(),
          due_back_at: due_back_at || null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData({ ...sample, ...updatedData });

        const updatedSample = await base44.asServiceRole.entities.SampleV2.update(sample_id, updatedData);
        await createMovement(updatedSample, 'checkout', fromLocType, fromLocRef, 'project', project_id, notes);

        return Response.json({ success: true, sample: updatedSample });
      }

      case 'returnSample': {
        const { sample_id, return_to, vehicle_id, notes } = payload;
        
        if (!sample_id || !return_to) {
          return Response.json({ success: false, error: 'sample_id and return_to are required' }, { status: 400 });
        }

        const sample = await base44.asServiceRole.entities.SampleV2.get(sample_id);
        if (!sample) {
          return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
        }

        if (sample.status === 'retired') {
          return Response.json({ success: false, error: 'Cannot return retired sample' }, { status: 400 });
        }

        const fromLocType = sample.current_location_type;
        const fromLocRef = sample.current_location_reference_id;

        let toLocType, toLocRef;

        if (return_to === 'home') {
          if (sample.home_location_type === 'warehouse') {
            toLocType = 'warehouse';
            toLocRef = null;
          } else if (sample.home_location_type === 'vehicle') {
            if (!sample.home_location_reference_id) {
              return Response.json({ success: false, error: 'home_location_reference_id is not set for vehicle home' }, { status: 400 });
            }
            toLocType = 'vehicle';
            toLocRef = sample.home_location_reference_id;
          }
        } else if (return_to === 'warehouse') {
          toLocType = 'warehouse';
          toLocRef = null;
        } else if (return_to === 'vehicle') {
          if (!vehicle_id) {
            return Response.json({ success: false, error: 'vehicle_id is required when return_to is vehicle' }, { status: 400 });
          }
          toLocType = 'vehicle';
          toLocRef = vehicle_id;
        } else {
          return Response.json({ success: false, error: 'return_to must be home, warehouse, or vehicle' }, { status: 400 });
        }

        const updatedData = {
          current_location_type: toLocType,
          current_location_reference_id: toLocRef,
          checked_out_project_id: null,
          checked_out_by_user_id: null,
          checked_out_at: null,
          due_back_at: null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData({ ...sample, ...updatedData });

        const updatedSample = await base44.asServiceRole.entities.SampleV2.update(sample_id, updatedData);
        await createMovement(updatedSample, 'return', fromLocType, fromLocRef, toLocType, toLocRef, notes);

        return Response.json({ success: true, sample: updatedSample });
      }

      case 'transferToVehicle': {
        const { sample_id, vehicle_id, notes } = payload;
        
        if (!sample_id || !vehicle_id) {
          return Response.json({ success: false, error: 'sample_id and vehicle_id are required' }, { status: 400 });
        }

        const sample = await base44.asServiceRole.entities.SampleV2.get(sample_id);
        if (!sample) {
          return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
        }

        if (sample.status === 'retired') {
          return Response.json({ success: false, error: 'Cannot transfer retired sample' }, { status: 400 });
        }

        if (sample.checked_out_project_id) {
          console.warn('Warning: Transferring sample to vehicle while checked out to project. This should be discouraged.');
        }

        const fromLocType = sample.current_location_type;
        const fromLocRef = sample.current_location_reference_id;

        const updatedData = {
          current_location_type: 'vehicle',
          current_location_reference_id: vehicle_id,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData({ ...sample, ...updatedData });

        const updatedSample = await base44.asServiceRole.entities.SampleV2.update(sample_id, updatedData);
        await createMovement(updatedSample, 'transfer', fromLocType, fromLocRef, 'vehicle', vehicle_id, notes);

        return Response.json({ success: true, sample: updatedSample });
      }

      case 'markLost': {
        const { sample_id, notes } = payload;
        
        if (!sample_id) {
          return Response.json({ success: false, error: 'sample_id is required' }, { status: 400 });
        }

        const sample = await base44.asServiceRole.entities.SampleV2.get(sample_id);
        if (!sample) {
          return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
        }

        const fromLocType = sample.current_location_type;
        const fromLocRef = sample.current_location_reference_id;

        const updatedData = {
          status: 'lost',
          current_location_type: 'unknown',
          current_location_reference_id: null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData({ ...sample, ...updatedData });

        const updatedSample = await base44.asServiceRole.entities.SampleV2.update(sample_id, updatedData);
        await createMovement(updatedSample, 'mark_lost', fromLocType, fromLocRef, 'unknown', null, notes);

        return Response.json({ success: true, sample: updatedSample });
      }

      case 'markFound': {
        const { sample_id, found_location_type, vehicle_id, notes } = payload;
        
        if (!sample_id || !found_location_type) {
          return Response.json({ success: false, error: 'sample_id and found_location_type are required' }, { status: 400 });
        }

        const sample = await base44.asServiceRole.entities.SampleV2.get(sample_id);
        if (!sample) {
          return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
        }

        let toLocType, toLocRef;

        if (found_location_type === 'warehouse') {
          toLocType = 'warehouse';
          toLocRef = null;
        } else if (found_location_type === 'vehicle') {
          if (!vehicle_id) {
            return Response.json({ success: false, error: 'vehicle_id is required when found_location_type is vehicle' }, { status: 400 });
          }
          toLocType = 'vehicle';
          toLocRef = vehicle_id;
        } else {
          return Response.json({ success: false, error: 'found_location_type must be warehouse or vehicle' }, { status: 400 });
        }

        const fromLocType = sample.current_location_type;
        const fromLocRef = sample.current_location_reference_id;

        const updatedData = {
          status: 'active',
          current_location_type: toLocType,
          current_location_reference_id: toLocRef,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData({ ...sample, ...updatedData });

        const updatedSample = await base44.asServiceRole.entities.SampleV2.update(sample_id, updatedData);
        await createMovement(updatedSample, 'mark_found', fromLocType, fromLocRef, toLocType, toLocRef, notes);

        return Response.json({ success: true, sample: updatedSample });
      }

      case 'retireSample': {
        const { sample_id, notes } = payload;
        
        if (!sample_id) {
          return Response.json({ success: false, error: 'sample_id is required' }, { status: 400 });
        }

        const sample = await base44.asServiceRole.entities.SampleV2.get(sample_id);
        if (!sample) {
          return Response.json({ success: false, error: 'Sample not found' }, { status: 404 });
        }

        const fromLocType = sample.current_location_type;
        const fromLocRef = sample.current_location_reference_id;

        const updatedData = {
          status: 'retired',
          checked_out_project_id: null,
          checked_out_by_user_id: null,
          checked_out_at: null,
          due_back_at: null,
          last_seen_at: new Date().toISOString(),
        };

        validateSampleData({ ...sample, ...updatedData });

        const updatedSample = await base44.asServiceRole.entities.SampleV2.update(sample_id, updatedData);
        await createMovement(updatedSample, 'retire', fromLocType, fromLocRef, sample.current_location_type, sample.current_location_reference_id, notes);

        return Response.json({ success: true, sample: updatedSample });
      }

      default:
        return Response.json({ 
          success: false, 
          error: `Unknown action: ${action}. Supported actions: createSample, checkoutToProject, returnSample, transferToVehicle, markLost, markFound, retireSample` 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in manageSampleV2:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});