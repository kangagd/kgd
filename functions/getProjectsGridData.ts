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

    // Create lookup maps for efficient counting
    const jobsByProject = new Map();
    const partsByProject = new Map();
    const tradesByProject = new Map();
    const posByProject = new Map();
    const attentionByProject = new Map();
    const threadsByProject = new Map();

    jobs.forEach(j => {
      if (j.project_id) {
        jobsByProject.set(j.project_id, (jobsByProject.get(j.project_id) || 0) + 1);
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
      const linked = po.xero_invoices ? Array.isArray(po.xero_invoices) ? po.xero_invoices : [po.xero_invoices] : [];
      linked.forEach(inv => {
        if (inv && typeof inv === 'string') {
          posByProject.set(inv, (posByProject.get(inv) || 0) + 1);
        }
      });
    });

    attention.forEach(ai => {
      if (ai.project_id) {
        attentionByProject.set(ai.project_id, (attentionByProject.get(ai.project_id) || 0) + 1);
      }
    });

    threads.forEach(t => {
      if (t.project_id && !t.is_deleted) {
        threadsByProject.set(t.project_id, (threadsByProject.get(t.project_id) || 0) + 1);
      }
    });

    // Map projects to grid data with counts only
    const gridData = projects.map(p => ({
      id: p.id,
      project_number: p.project_number,
      title: p.title,
      customer_name: p.customer_name,
      status: p.status,
      updated_date: p.updated_date,
      job_count: jobsByProject.get(p.id) || 0,
      part_count: partsByProject.get(p.id) || 0,
      trade_count: tradesByProject.get(p.id) || 0,
      po_count: posByProject.get(p.id) || 0,
      attention_count: attentionByProject.get(p.id) || 0,
      thread_count: threadsByProject.get(p.id) || 0,
    }));

    return Response.json({ projects: gridData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});