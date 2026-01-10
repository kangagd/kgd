import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Assigns or removes owner of an email thread
 * Logs ownership changes in EmailAudit
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, owner_user_id } = await req.json();

    if (!thread_id) {
      return Response.json({ error: 'thread_id required' }, { status: 400 });
    }

    // Get thread
    const thread = await base44.entities.EmailThread.get(thread_id);
    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get owner user if assigning
    let ownerEmail = null;
    let ownerName = null;
    let action = 'owner_removed';

    if (owner_user_id) {
      const ownerUser = await base44.entities.User.get(owner_user_id);
      if (!ownerUser) {
        return Response.json({ error: 'Owner user not found' }, { status: 404 });
      }
      ownerEmail = ownerUser.email;
      ownerName = ownerUser.full_name;
      action = 'owner_assigned';
    }

    // Update thread
    await base44.entities.EmailThread.update(thread_id, {
      owner_user_id: owner_user_id || null,
      owner_user_email: ownerEmail,
      owner_user_name: ownerName
    });

    // Log audit
    try {
      await base44.entities.EmailAudit.create({
        thread_id,
        action,
        field_changed: 'owner_user_id',
        old_value: thread.owner_user_id || 'unowned',
        new_value: owner_user_id || 'unowned',
        changed_by_email: user.email,
        changed_by_name: user.full_name,
        reason: `Owner ${action === 'owner_assigned' ? 'assigned to' : 'removed from'} ${ownerName || 'unassigned'}`
      });
    } catch (auditErr) {
      console.warn('Failed to create audit log:', auditErr);
    }

    return Response.json({
      success: true,
      thread_id,
      owner_user_id: owner_user_id || null,
      owner_user_email: ownerEmail,
      owner_user_name: ownerName
    });
  } catch (error) {
    console.error('Error assigning thread owner:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});