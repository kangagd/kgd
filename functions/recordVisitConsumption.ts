import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validateConsumptionCreation, reconcileAllocationAfterConsumption } from './shared/consumptionValidation.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Admin-only initially
    if (user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { 
      project_id, 
      visit_id, 
      source_allocation_id, 
      qty_consumed, 
      notes 
    } = body;

    // Prepare consumption data for validation
    const consumptionData = {
      project_id,
      visit_id,
      source_allocation_id,
      qty_consumed,
      notes
    };

    // Validate using shared helper
    const validation = await validateConsumptionCreation(base44.asServiceRole, consumptionData, user);
    if (!validation.valid) {
      return Response.json({ 
        success: false, 
        error: validation.error 
      }, { status: 400 });
    }

    // Load allocation if provided
    let allocation = null;
    let catalog_item_id = null;
    let description = null;
    let from_location_id = null;

    if (source_allocation_id) {
      allocation = await base44.asServiceRole.entities.StockAllocation.get(source_allocation_id);

      catalog_item_id = allocation.catalog_item_id;
      description = allocation.description;

      // Determine from_location_id from vehicle_id
      if (allocation.vehicle_id) {
        const vehicleLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
          vehicle_id: allocation.vehicle_id
        });
        if (vehicleLocations.length > 0) {
          from_location_id = vehicleLocations[0].id;
        }
      } else if (allocation.from_location_id) {
        from_location_id = allocation.from_location_id;
      }
    }

    // Create StockConsumption record
    const consumption = await base44.asServiceRole.entities.StockConsumption.create({
      project_id,
      visit_id,
      source_allocation_id: source_allocation_id || null,
      catalog_item_id: catalog_item_id || null,
      description: description || body.description || null,
      qty_consumed,
      consumed_from_location_id: from_location_id || null,
      consumed_by_user_id: user.id || null,
      consumed_by_name: user.full_name || user.email,
      consumed_at: new Date().toISOString(),
      notes: notes || null
    });

    // Create StockMovement for audit trail
    let movement = null;
    if (from_location_id && catalog_item_id) {
      movement = await base44.asServiceRole.entities.StockMovement.create({
        source: 'job_usage',
        project_id,
        visit_id,
        catalog_item_id,
        description,
        quantity: qty_consumed,
        from_location_id,
        to_location_id: null, // consumed (no destination)
        performed_by_user_id: user.id || null,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.email,
        performed_at: new Date().toISOString(),
        write_source: 'job_usage',
        notes: `Consumed from visit ${visit_id}${notes ? ': ' + notes : ''}`
      });
    }

    return Response.json({
      success: true,
      consumption,
      movement: movement ? { id: movement.id } : null
    });

  } catch (error) {
    console.error('[recordVisitConsumption] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});