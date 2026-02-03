import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import crypto from 'node:crypto';

/**
 * Checks for an existing draft/planned/in_progress run matching source_type + source_ref_id.
 * If found, returns it. Otherwise, creates a new draft run.
 * If a matching run is completed/cancelled, allows creating a new one.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      source_type,
      source_ref_id,
      assigned_to_user_id,
      assigned_to_name,
      vehicle_id,
      notes,
    } = body;

    if (!source_type || !source_ref_id) {
      return Response.json(
        { error: 'source_type and source_ref_id are required' },
        { status: 400 }
      );
    }

    // Search for existing draft/planned/in_progress run
    const existingRuns = await base44.asServiceRole.entities.LogisticsRun.filter({
      source_type,
      source_ref_id,
      status: { $in: ['draft', 'scheduled', 'in_progress'] },
    });

    if (existingRuns.length > 0) {
      // Return the first matching run (prefer oldest draft)
      const existingRun = existingRuns[0];
      return Response.json({
        success: true,
        run_id: existingRun.id,
        is_new: false,
        run: existingRun,
      });
    }

    // No active run found, create a new one
    const newRun = await base44.asServiceRole.entities.LogisticsRun.create({
      source_type,
      source_ref_id,
      assigned_to_user_id: assigned_to_user_id || null,
      assigned_to_name: assigned_to_name || null,
      vehicle_id: vehicle_id || null,
      notes: notes || null,
      status: 'draft',
    });

    return Response.json({
      success: true,
      run_id: newRun.id,
      is_new: true,
      run: newRun,
    });
  } catch (error) {
    console.error('getOrReuseLogisticsRun error:', error);
    return Response.json(
      { error: error.message || 'Failed to get or create run' },
      { status: 500 }
    );
  }
});