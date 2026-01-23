import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Derive visit status from current state
 */
const deriveVisitStatus = (visit) => {
  if (visit.cancelled_at || visit.status === 'cancelled') return 'cancelled';
  if (visit.completed_at) return 'completed';
  
  // Check for active check-ins
  const hasActiveCheckIn = (visit.check_in_events || []).some(e => !e.checked_out_at);
  const hasCheckedInTechs = (visit.checked_in_technicians || []).length > 0;
  if (hasActiveCheckIn || hasCheckedInTechs) return 'in_progress';
  
  if (visit.scheduled_date) return 'scheduled';
  return 'draft';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, visit_id, job_id, data } = await req.json();

    if (!action) {
      return Response.json({ error: 'Missing required parameter: action' }, { status: 400 });
    }

    // CREATE
    if (action === 'create') {
      if (!job_id) {
        return Response.json({ error: 'Missing job_id for create action' }, { status: 400 });
      }

      // Verify job exists
      const job = await base44.asServiceRole.entities.Job.get(job_id);
      if (!job) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }

      // Auto-increment visit_number
      const existingVisits = await base44.asServiceRole.entities.Visit.filter({ job_id });
      const visit_number = existingVisits.length + 1;

      const visitData = {
        job_id,
        visit_number,
        scheduled_date: data?.scheduled_date || null,
        scheduled_time: data?.scheduled_time || null,
        expected_duration: data?.expected_duration || null,
        checked_in_technicians: [],
        checked_in_names: [],
        check_in_events: [],
        photos: [],
        ...data
      };

      // Auto-derive status based on initial state
      visitData.status = deriveVisitStatus(visitData);

      const visit = await base44.asServiceRole.entities.Visit.create(visitData);
      return Response.json({ success: true, visit });
    }

    // CHECK IN
    if (action === 'checkIn') {
      if (!visit_id) {
        return Response.json({ error: 'Missing visit_id for checkIn action' }, { status: 400 });
      }

      const visit = await base44.asServiceRole.entities.Visit.get(visit_id);
      if (!visit) {
        return Response.json({ error: 'Visit not found' }, { status: 404 });
      }

      // Check if already checked in
      const alreadyCheckedIn = (visit.checked_in_technicians || []).includes(user.email);
      if (alreadyCheckedIn) {
        return Response.json({ error: 'Already checked in to this visit' }, { status: 400 });
      }

      const checkInEvent = {
        technician_email: user.email,
        technician_name: user.display_name || user.full_name,
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      };

      const updatedVisit = await base44.asServiceRole.entities.Visit.update(visit.id, {
        checked_in_technicians: [...(visit.checked_in_technicians || []), user.email],
        checked_in_names: [...(visit.checked_in_names || []), user.display_name || user.full_name],
        check_in_events: [...(visit.check_in_events || []), checkInEvent],
        status: 'in_progress'
      });

      return Response.json({ success: true, visit: updatedVisit });
    }

    // CHECK OUT
    if (action === 'checkOut') {
      if (!visit_id) {
        return Response.json({ error: 'Missing visit_id for checkOut action' }, { status: 400 });
      }

      const visit = await base44.asServiceRole.entities.Visit.get(visit_id);
      if (!visit) {
        return Response.json({ error: 'Visit not found' }, { status: 404 });
      }

      // Find active check-in event
      const checkInEvents = visit.check_in_events || [];
      const activeEventIndex = checkInEvents.findIndex(
        event => event.technician_email === user.email && !event.checked_out_at
      );

      if (activeEventIndex === -1) {
        return Response.json({ error: 'No active check-in found for this technician' }, { status: 400 });
      }

      // Update check-in event with check-out time
      const checkOutTime = new Date().toISOString();
      const updatedEvents = [...checkInEvents];
      updatedEvents[activeEventIndex] = {
        ...updatedEvents[activeEventIndex],
        checked_out_at: checkOutTime
      };

      // Remove from checked-in arrays
      const updatedTechnicians = (visit.checked_in_technicians || []).filter(email => email !== user.email);
      const updatedNames = (visit.checked_in_names || []).filter((name, idx) => 
        (visit.checked_in_technicians || [])[idx] !== user.email
      );

      // Determine if this is the last technician
      const isLastTechnician = updatedTechnicians.length === 0;

      // AUTHORITY CHECK: Only last technician can set outcome and complete the visit
      const attemptingToComplete = data?.outcome || data?.completed_at;
      if (attemptingToComplete && !isLastTechnician) {
        return Response.json({ 
          error: 'ONLY_LAST_TECH_CAN_COMPLETE_VISIT',
          message: 'Only the last checked-in technician can complete the visit'
        }, { status: 403 });
      }

      // Build update payload (all technicians can update draft fields)
      const updates = {
        checked_in_technicians: updatedTechnicians,
        checked_in_names: updatedNames,
        check_in_events: updatedEvents,
        work_performed: data?.work_performed || visit.work_performed,
        issues_found: data?.issues_found || visit.issues_found,
        resolution: data?.resolution || visit.resolution,
        measurements: data?.measurements || visit.measurements,
        photos: data?.photos || visit.photos,
        communication_notes: data?.communication_notes || visit.communication_notes,
        next_steps: data?.next_steps || visit.next_steps
      };

      // ONLY last technician can set completion fields
      if (isLastTechnician && data?.outcome) {
        updates.outcome = data.outcome;
        updates.completed_at = checkOutTime;
        updates.completed_by_email = user.email;
        updates.completed_by_name = user.display_name || user.full_name;
        updates.status = 'completed';
      } else if (updatedTechnicians.length === 0) {
        // All technicians checked out but no completion — keep as in_progress
        updates.status = 'in_progress';
      }

      const updatedVisit = await base44.asServiceRole.entities.Visit.update(visit.id, updates);
      return Response.json({ success: true, visit: updatedVisit, is_last_technician: isLastTechnician });
    }

    // UPDATE
    if (action === 'update') {
      if (!visit_id) {
        return Response.json({ error: 'Missing visit_id for update action' }, { status: 400 });
      }

      const visit = await base44.asServiceRole.entities.Visit.get(visit_id);
      if (!visit) {
        return Response.json({ error: 'Visit not found' }, { status: 404 });
      }

      // Merge data and re-derive status
      const merged = { ...visit, ...data };
      const statusUpdate = { ...data, status: deriveVisitStatus(merged) };

      const updatedVisit = await base44.asServiceRole.entities.Visit.update(visit_id, statusUpdate);
      return Response.json({ success: true, visit: updatedVisit });
    }

    // DELETE
    if (action === 'delete') {
      if (!visit_id) {
        return Response.json({ error: 'Missing visit_id for delete action' }, { status: 400 });
      }

      // Only admins can delete visits
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Only admins can delete visits' }, { status: 403 });
      }

      await base44.asServiceRole.entities.Visit.delete(visit_id);
      return Response.json({ success: true, deleted: true });
    }

    return Response.json({ error: 'Invalid action. Supported: create, checkIn, checkOut, update, delete' }, { status: 400 });
  } catch (error) {
    console.error('Error managing visit:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});