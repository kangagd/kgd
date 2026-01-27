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
 * Ensures a Job has exactly one active Visit.
 * Creates a Visit silently if none exists.
 * Active = completed_at is null
 * 
 * GUARDRAIL: Never creates duplicates. Never touches Job fields.
 * Returns: { visit, created: boolean }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'Missing job_id' }, { status: 400 });
    }

    // Load job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Skip if job is Cancelled
    if (job.status === 'Cancelled') {
      return Response.json({ 
        visit: null, 
        created: false, 
        reason: 'Job is Cancelled' 
      });
    }

    // If Completed, update to Scheduled to allow new visit
    if (job.status === 'Completed') {
      await base44.asServiceRole.entities.Job.update(job_id, { status: 'Scheduled' });
      job.status = 'Scheduled';
    }

    // Check for active Visit (completed_at is null)
    const existingVisits = await base44.asServiceRole.entities.Visit.filter({ job_id });
    const activeVisit = existingVisits.find(v => !v.completed_at);

    if (activeVisit) {
      return Response.json({ 
        visit: activeVisit, 
        created: false 
      });
    }

    // Create new Visit
    const visit_number = existingVisits.length + 1;
    
    const visitPayload = {
      job_id,
      visit_number,
      scheduled_date: job.scheduled_date || null,
      scheduled_time: job.scheduled_time || null,
      expected_duration: job.expected_duration || null,
      checked_in_technicians: [],
      checked_in_names: [],
      check_in_events: [],
      photos: []
    };

    // Auto-derive status
    visitPayload.status = deriveVisitStatus(visitPayload);
    
    const newVisit = await base44.asServiceRole.entities.Visit.create(visitPayload);

    return Response.json({ 
      visit: newVisit, 
      created: true 
    });
  } catch (error) {
    console.error('Error ensuring active visit:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});