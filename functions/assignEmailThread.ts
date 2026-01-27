import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { thread_id, assigned_to_email, note } = await req.json();
    
    if (!thread_id) {
      return Response.json({ error: 'Thread ID is required' }, { status: 400 });
    }
    
    // Handle unassignment
    if (!assigned_to_email || assigned_to_email === null) {
      await base44.asServiceRole.entities.EmailThread.update(thread_id, {
        assigned_to: null,
        assigned_to_name: null,
        last_worked_by: user.email,
        last_worked_by_name: user.display_name || user.full_name,
        last_worked_at: new Date().toISOString()
      });
      
      return Response.json({ 
        success: true,
        assigned_to: null,
        assigned_to_name: null
      });
    }
    
    // Get assigned user details
    const assignedUser = await base44.asServiceRole.entities.User.filter({ email: assigned_to_email });
    if (!assignedUser || assignedUser.length === 0) {
      return Response.json({ error: 'Assigned user not found' }, { status: 404 });
    }
    
    const assignedUserData = assignedUser[0];
    
    // Update thread assignment
    await base44.asServiceRole.entities.EmailThread.update(thread_id, {
      assigned_to: assigned_to_email,
      assigned_to_name: assignedUserData.display_name || assignedUserData.full_name,
      assigned_by: user.email,
      assigned_by_name: user.display_name || user.full_name,
      assigned_at: new Date().toISOString(),
      last_worked_by: user.email,
      last_worked_by_name: user.display_name || user.full_name,
      last_worked_at: new Date().toISOString()
    });
    
    // Get thread details for notification
    const thread = await base44.asServiceRole.entities.EmailThread.get(thread_id);
    
    // Create notification for assigned user (if not assigning to self)
    if (assigned_to_email !== user.email) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: assigned_to_email,
        type: 'email_assigned',
        title: 'Email Thread Assigned',
        message: `${user.display_name || user.full_name} assigned you an email thread: "${thread.subject}"`,
        link: `/Inbox?threadId=${thread_id}`,
        is_read: false,
        priority: 'normal',
        data: {
          thread_id: thread_id,
          assigned_by: user.email,
          assigned_by_name: user.display_name || user.full_name
        }
      });
    }
    
    // Add internal note if provided
    if (note && note.trim()) {
      await base44.asServiceRole.entities.EmailThreadNote.create({
        thread_id: thread_id,
        note: note.trim(),
        created_by: user.email,
        created_by_name: user.display_name || user.full_name
      });
    }
    
    return Response.json({ 
      success: true,
      assigned_to: assigned_to_email,
      assigned_to_name: assignedUserData.display_name || assignedUserData.full_name
    });
  } catch (error) {
    console.error('Error assigning thread:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});