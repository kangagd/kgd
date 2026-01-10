import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Updates email thread status based on message activity
 * 
 * Rules:
 * - Incoming customer email → status = "Open"
 * - Outgoing reply → status = "Waiting on Customer"
 * - Internal-only message → status = "Internal"
 * - Manual close via API → status = "Closed" (handled by frontend)
 * 
 * Also updates linked Project/Job last_activity_at timestamps
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, message_id, is_outbound, is_internal } = await req.json();

    if (!thread_id) {
      return Response.json({ error: 'thread_id required' }, { status: 400 });
    }

    // Get thread
    const thread = await base44.entities.EmailThread.get(thread_id);
    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Determine new status
    let newStatus = thread.status;
    let reason = '';

    if (is_outbound) {
      newStatus = 'Waiting on Customer';
      reason = 'Outgoing reply sent';
    } else if (is_internal) {
      newStatus = 'Internal';
      reason = 'Internal-only message';
    } else if (!is_outbound && !is_internal) {
      newStatus = 'Open';
      reason = 'Incoming customer email';
    }

    // Only update if status changed
    if (newStatus !== thread.status) {
      const now = new Date().toISOString();

      // Update thread
      await base44.entities.EmailThread.update(thread_id, {
        status: newStatus,
        last_activity_at: now
      });

      // Log audit
      try {
        await base44.entities.EmailAudit.create({
          thread_id,
          action: 'status_changed',
          field_changed: 'status',
          old_value: thread.status,
          new_value: newStatus,
          changed_by_email: user.email,
          changed_by_name: user.full_name,
          reason
        });
      } catch (auditErr) {
        console.warn('Failed to create audit log:', auditErr);
      }

      // Update linked Project/Job last_activity_at
      try {
        const updates = [];
        if (thread.project_id) {
          updates.push(
            base44.entities.Project.update(thread.project_id, {
              last_activity_at: now,
              last_activity_type: `Email: ${reason}`
            })
          );
        }
        if (thread.job_id) {
          updates.push(
            base44.entities.Job.update(thread.job_id, {
              // Jobs don't have last_activity_at yet, but could add this field
            })
          );
        }
        if (updates.length > 0) {
          await Promise.all(updates);
        }
      } catch (err) {
        console.warn('Failed to update Project/Job activity:', err);
      }
    }

    return Response.json({
      success: true,
      thread_id,
      old_status: thread.status,
      new_status: newStatus,
      changed: newStatus !== thread.status
    });
  } catch (error) {
    console.error('Error updating thread status:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});