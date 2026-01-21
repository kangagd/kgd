import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Ensures bidirectional linking between Job.visit_scope and Part.linked_logistics_jobs
 * This prevents parts from becoming invisible in logistics job transfer modals
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Extract part IDs from visit_scope
    const partIdsFromScope = (job.visit_scope || [])
      .filter(item => item.type === 'part' && item.ref_id)
      .map(item => item.ref_id);

    if (partIdsFromScope.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No parts in visit_scope to sync',
        parts_updated: 0 
      });
    }

    // Update each part to include this job in linked_logistics_jobs
    let updatedCount = 0;
    const errors = [];

    for (const partId of partIdsFromScope) {
      try {
        const part = await base44.asServiceRole.entities.Part.get(partId);
        if (!part) {
          errors.push(`Part ${partId} not found`);
          continue;
        }

        const existingLinks = part.linked_logistics_jobs || [];
        if (!existingLinks.includes(job_id)) {
          await base44.asServiceRole.entities.Part.update(partId, {
            linked_logistics_jobs: [...existingLinks, job_id]
          });
          updatedCount++;
        }
      } catch (err) {
        errors.push(`Failed to update part ${partId}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${updatedCount} part(s) to job ${job.job_number || job_id}`,
      parts_updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});