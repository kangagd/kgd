import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Query for orphan allocations: empty/null catalog labels OR needs_relink=true
    const orphans = await base44.asServiceRole.entities.StockAllocation.filter({
      $or: [
        {
          $and: [
            { catalog_item_id: { $in: [null, ''] } },
            { catalog_item_name: { $in: [null, '', 'Part'] } }
          ]
        },
        { needs_relink: true }
      ]
    }, '-allocated_at', 1000);

    // Fetch related project/job data for display
    const projectIds = [...new Set(orphans.map(a => a.project_id).filter(Boolean))];
    const jobIds = [...new Set(orphans.map(a => a.job_id).filter(Boolean))];

    const [projects, jobs] = await Promise.all([
      projectIds.length > 0 
        ? base44.asServiceRole.entities.Project.filter({ id: { $in: projectIds } })
        : Promise.resolve([]),
      jobIds.length > 0
        ? base44.asServiceRole.entities.Job.filter({ id: { $in: jobIds } })
        : Promise.resolve([])
    ]);

    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));

    // Enrich orphans with display info
    const enriched = orphans.map(alloc => ({
      id: alloc.id,
      project_id: alloc.project_id,
      project_number: projectMap[alloc.project_id]?.project_number,
      project_title: projectMap[alloc.project_id]?.title,
      job_id: alloc.job_id,
      job_number: jobMap[alloc.job_id]?.job_number,
      customer_name: jobMap[alloc.job_id]?.customer_name || projectMap[alloc.project_id]?.customer_name,
      requirement_line_id: alloc.requirement_line_id,
      qty_allocated: alloc.qty_allocated,
      status: alloc.status,
      needs_relink: alloc.needs_relink,
      label_source: alloc.label_source,
      catalog_item_name: alloc.catalog_item_name,
      created_date: alloc.created_date,
      allocated_at: alloc.allocated_at
    }));

    return Response.json({
      success: true,
      total: enriched.length,
      allocations: enriched
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});