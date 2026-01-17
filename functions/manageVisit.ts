import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
        check_in_events: [...(visit.check_in_events || []), checkInEvent]
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
      const updatedEvents = [...checkInEvents];
      updatedEvents[activeEventIndex] = {
        ...updatedEvents[activeEventIndex],
        checked_out_at: new Date().toISOString()
      };

      // Remove from checked-in arrays
      const updatedTechnicians = (visit.checked_in_technicians || []).filter(email => email !== user.email);
      const updatedNames = (visit.checked_in_names || []).filter((name, idx) => 
        (visit.checked_in_technicians || [])[idx] !== user.email
      );

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
        next_steps: data?.next_steps || visit.next_steps,
        outcome: data?.outcome || visit.outcome
      };

      // If last technician checking out and outcome provided, mark as completed
      if (updatedTechnicians.length === 0 && data?.outcome) {
        updates.completed_at = new Date().toISOString();
        updates.completed_by_email = user.email;
        updates.completed_by_name = user.display_name || user.full_name;
      }

      const updatedVisit = await base44.asServiceRole.entities.Visit.update(visit.id, updates);
      return Response.json({ success: true, visit: updatedVisit });
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

      const updatedVisit = await base44.asServiceRole.entities.Visit.update(visit_id, data);
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