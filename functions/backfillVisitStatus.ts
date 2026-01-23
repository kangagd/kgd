import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Derive visit status from current state
 */
const deriveVisitStatus = (visit) => {
  if (visit.cancelled_at || visit.status === 'cancelled') return 'cancelled';
  if (visit.completed_at) return 'completed';
  
  const hasActiveCheckIn = (visit.check_in_events || []).some(e => !e.checked_out_at);
  const hasCheckedInTechs = (visit.checked_in_technicians || []).length > 0;
  if (hasActiveCheckIn || hasCheckedInTechs) return 'in_progress';
  
  if (visit.scheduled_date) return 'scheduled';
  return 'draft';
};

/**
 * Backfill Visit.status for existing records
 * 
 * Admin-only. Batch processes all visits and updates status if:
 * - status is null, OR
 * - status is "draft" but derived status differs
 * 
 * POST body: { batchSize: 100, dryRun: false }
 * Returns: { scanned, updated, countsByStatus, dryRun }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { batchSize = 100, dryRun = false } = body;

    let scanned = 0;
    let updated = 0;
    const countsByStatus = {};
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const visits = await base44.asServiceRole.entities.Visit.list('created_date', batchSize, skip);
      
      if (!visits || visits.length === 0) {
        hasMore = false;
        break;
      }

      for (const visit of visits) {
        if (!visit || !visit.id) continue;

        scanned++;

        const derived = deriveVisitStatus(visit);
        const current = visit.status || 'draft';

        // Count current statuses
        countsByStatus[current] = (countsByStatus[current] || 0) + 1;

        // Check if update needed
        const needsUpdate = 
          visit.status === null ||
          (visit.status === 'draft' && derived !== 'draft');

        if (needsUpdate && !dryRun) {
          await base44.asServiceRole.entities.Visit.update(visit.id, {
            status: derived
          });
          updated++;
        }
      }

      skip += batchSize;
      
      // Safety check: stop if no visits fetched
      if (visits.length < batchSize) {
        hasMore = false;
      }
    }

    return Response.json({
      success: true,
      scanned,
      updated,
      countsByStatus,
      dryRun
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});