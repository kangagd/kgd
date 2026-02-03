import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Compute visit readiness status based on project requirements and stock allocations.
 * Updates the Visit record with derived readiness fields.
 *
 * Logic:
 * - For each blocking requirement line, sum allocated qty (where status != "released")
 * - If allocated < required, counts as blocking missing
 * - Ready if blocking_missing == 0 AND total_allocated >= total_required
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { visit_id } = body;

    if (!visit_id) {
      return Response.json({ error: 'visit_id is required' }, { status: 400 });
    }

    // Fetch visit and project
    const visit = await base44.asServiceRole.entities.Visit.get(visit_id);
    if (!visit) {
      return Response.json({ error: 'Visit not found' }, { status: 404 });
    }

    const job = await base44.asServiceRole.entities.Job.get(visit.job_id);
    if (!job || !job.project_id) {
      // No project, can't compute readiness
      return Response.json({
        success: true,
        visit_id,
        readiness_status: 'not_ready',
        message: 'Job has no project',
      });
    }

    // Fetch project requirement lines
    const projectReqLines = await base44.asServiceRole.entities.ProjectRequirementLine.filter({
      project_id: job.project_id,
    });

    // Fetch allocations for this visit
    const allocations = await base44.asServiceRole.entities.StockAllocation.filter({
      visit_id,
    });

    // Separate blocking and non-blocking requirements
    const blockingReqs = projectReqLines.filter(r => r.is_blocking === true);
    const allReqs = projectReqLines;

    // Compute blocking missing
    let blockingMissingCount = 0;
    let blockingMissingDetails = [];

    for (const req of blockingReqs) {
      const allocatedForReq = allocations
        .filter(a => a.requirement_line_id === req.id && a.status !== 'released')
        .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);

      const requiredQty = req.qty_required || 0;
      if (allocatedForReq < requiredQty) {
        const missing = requiredQty - allocatedForReq;
        blockingMissingCount += 1;
        blockingMissingDetails.push({
          requirement_id: req.id,
          label: req.label || 'Requirement',
          required: requiredQty,
          allocated: allocatedForReq,
          missing,
        });
      }
    }

    // Compute total readiness
    const totalRequired = allReqs.reduce((sum, r) => sum + (r.qty_required || 0), 0);
    const totalAllocated = allocations
      .filter(a => a.status !== 'released')
      .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);

    // Determine readiness status
    let readinessStatus = 'ready';
    if (blockingMissingCount > 0) {
      readinessStatus = 'not_ready';
    } else if (totalAllocated < totalRequired) {
      readinessStatus = 'partially_ready';
    }

    // Build summary
    const summary = `${blockingMissingCount} blocking missing${
      blockingMissingCount !== 1 ? 's' : ''
    }, ${totalAllocated}/${totalRequired} total`;

    // Update visit with derived fields
    await base44.asServiceRole.entities.Visit.update(visit_id, {
      parts_readiness_status: readinessStatus,
      parts_readiness_updated_at: new Date().toISOString(),
      parts_readiness_summary_json: JSON.stringify({
        blocking_missing_count: blockingMissingCount,
        blocking_missing_details: blockingMissingDetails,
        total_required: totalRequired,
        total_allocated: totalAllocated,
      }),
    });

    return Response.json({
      success: true,
      visit_id,
      readiness_status: readinessStatus,
      blocking_missing_count: blockingMissingCount,
      total_required: totalRequired,
      total_allocated: totalAllocated,
      summary,
    });
  } catch (error) {
    console.error('computeVisitReadiness error:', error);
    return Response.json(
      { error: error.message || 'Failed to compute readiness' },
      { status: 500 }
    );
  }
});