import { createClientFromRequest } from './shared/sdk.js';

/**
 * Fetch minimal project relations for grid display.
 * Returns only IDs, counts, and essential fields—avoids N+1 and full entity loads.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all projects (RLS-filtered by Base44)
    const projects = await base44.asServiceRole.entities.Project.list('-updated_date', 500);

    // Batch fetch all required data in parallel
    const [jobs, parts, trades, pos, attention, threads] = await Promise.all([
      base44.asServiceRole.entities.Job.list(),
      base44.asServiceRole.entities.Part.list(),
      base44.asServiceRole.entities.ProjectTradeRequirement.list(),
      base44.asServiceRole.entities.PurchaseOrder.list(),
      base44.asServiceRole.entities.AttentionItem.list(),
      base44.asServiceRole.entities.EmailThread.list(),
    ]);

    // Create lookup maps for efficient counting and data
    const jobsByProject = new Map();
    const nextJobByProject = new Map();
    const partsByProject = new Map();
    const tradesByProject = new Map();
    const posByProject = new Map();
    const attentionByProject = new Map();
    const openAttentionByProject = new Map();
    const threadsByProject = new Map();
    const lastActivityByProject = new Map();
    const lastCustomerMessageByProject = new Map();

    jobs.forEach(j => {
      if (j.project_id) {
        const count = jobsByProject.get(j.project_id) || 0;
        jobsByProject.set(j.project_id, count + 1);
        
        // Track next scheduled job
        if (j.status !== 'Completed' && j.status !== 'Cancelled' && j.scheduled_date) {
          const existing = nextJobByProject.get(j.project_id);
          if (!existing || j.scheduled_date < existing.scheduled_date) {
            nextJobByProject.set(j.project_id, {
              id: j.id,
              job_number: j.job_number,
              scheduled_date: j.scheduled_date,
              scheduled_time: j.scheduled_time,
            });
          }
        }
      }
    });

    parts.forEach(p => {
      if (p.project_id) {
        partsByProject.set(p.project_id, (partsByProject.get(p.project_id) || 0) + 1);
      }
    });

    trades.forEach(t => {
      if (t.project_id) {
        tradesByProject.set(t.project_id, (tradesByProject.get(t.project_id) || 0) + 1);
      }
    });

    pos.forEach(po => {
      if (po.reference_id && po.reference_type === 'project') {
        posByProject.set(po.reference_id, (posByProject.get(po.reference_id) || 0) + 1);
      }
    });

    attention.forEach(ai => {
      if (ai.project_id) {
        const totalCount = attentionByProject.get(ai.project_id) || 0;
        attentionByProject.set(ai.project_id, totalCount + 1);
        
        // Count only unresolved attention items
        if (!ai.resolved_at) {
          const openCount = openAttentionByProject.get(ai.project_id) || 0;
          openAttentionByProject.set(ai.project_id, openCount + 1);
        }
      }
    });

    threads.forEach(t => {
      if (t.project_id && !t.is_deleted) {
        threadsByProject.set(t.project_id, (threadsByProject.get(t.project_id) || 0) + 1);
        
        // Track last customer message
        if (t.last_customer_message_at) {
          const existing = lastCustomerMessageByProject.get(t.project_id);
          if (!existing || t.last_customer_message_at > existing) {
            lastCustomerMessageByProject.set(t.project_id, t.last_customer_message_at);
          }
        }
      }
    });

    // Compute last activity for each project
    projects.forEach(p => {
      const timestamps = [p.last_activity_at, p.updated_date].filter(Boolean);
      
      const projectJobs = jobs.filter(j => j.project_id === p.id);
      projectJobs.forEach(j => {
        if (j.updated_date) timestamps.push(j.updated_date);
        if (j.scheduled_date) timestamps.push(j.scheduled_date);
      });
      
      if (timestamps.length > 0) {
        const latest = timestamps.sort((a, b) => new Date(b) - new Date(a))[0];
        lastActivityByProject.set(p.id, latest);
      }
    });

    // Map projects to grid data with counts and computed fields
    const gridData = projects.map(p => {
      const nextJob = nextJobByProject.get(p.id) || null;
      const lastActivityAt = lastActivityByProject.get(p.id) || p.updated_date;
      const lastCustomerMessageAt = lastCustomerMessageByProject.get(p.id) || null;
      
      // Compute freshness badge inputs (days since last activity)
      const daysSinceActivity = lastActivityAt 
        ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        // Core fields
        id: p.id,
        project_number: p.project_number,
        title: p.title,
        customer_name: p.customer_name,
        customer_id: p.customer_id,
        status: p.status,
        updated_date: p.updated_date,
        created_date: p.created_date,
        opened_date: p.opened_date,
        address_full: p.address_full,
        project_type: p.project_type,
        
        // Counts
        job_count: jobsByProject.get(p.id) || 0,
        part_count: partsByProject.get(p.id) || 0,
        trade_count: tradesByProject.get(p.id) || 0,
        po_count: posByProject.get(p.id) || 0,
        attention_count: attentionByProject.get(p.id) || 0,
        open_attention_count: openAttentionByProject.get(p.id) || 0,
        thread_count: threadsByProject.get(p.id) || 0,
        
        // Computed fields
        next_job: nextJob,
        last_activity_at: lastActivityAt,
        last_customer_message_at: lastCustomerMessageAt,
        days_since_activity: daysSinceActivity,
        
        // Pricing/tags for filtering
        total_project_value: p.total_project_value,
        financial_status: p.financial_status,
        project_tag_ids: p.project_tag_ids || [],
      };
    });

    return Response.json({ projects: gridData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});