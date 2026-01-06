import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { sample_movement_ids } = await req.json();

    if (!sample_movement_ids || !Array.isArray(sample_movement_ids) || sample_movement_ids.length === 0) {
      return Response.json({ 
        error: 'sample_movement_ids is required and must be a non-empty array' 
      }, { status: 400 });
    }

    let deletedCount = 0;
    const errors = [];

    for (const id of sample_movement_ids) {
      try {
        await base44.asServiceRole.entities.SampleMovement.delete(id);
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete sample movement ${id}:`, err);
        errors.push({ id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error deleting sample movements:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});