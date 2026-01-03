import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email_thread_id } = await req.json();

    if (!email_thread_id) {
      return Response.json({ error: 'email_thread_id is required' }, { status: 400 });
    }

    // Load EmailThread
    const thread = await base44.asServiceRole.entities.EmailThread.get(email_thread_id);
    
    // If no project linked, skip
    if (!thread.project_id) {
      return Response.json({ skipped: true, reason: 'No project linked to thread' });
    }

    // Load all messages in thread, sorted by sent_at descending
    const messages = await base44.asServiceRole.entities.EmailMessage.filter(
      { thread_id: email_thread_id },
      '-sent_at',
      1
    );

    if (messages.length === 0) {
      return Response.json({ skipped: true, reason: 'No messages in thread' });
    }

    const latestMessage = messages[0];
    const sentAt = latestMessage.sent_at || latestMessage.created_date;

    // Determine direction and update fields
    const updates = {
      last_activity_at: sentAt,
      last_activity_type: latestMessage.is_outbound ? 'Email Sent' : 'Email Received'
    };

    if (latestMessage.is_outbound) {
      updates.last_internal_message_at = sentAt;
    } else {
      updates.last_customer_message_at = sentAt;
    }

    // Update project
    await base44.asServiceRole.entities.Project.update(thread.project_id, updates);

    return Response.json({ 
      success: true, 
      project_id: thread.project_id,
      updates 
    });

  } catch (error) {
    console.error('Error in updateProjectLastContactFromThread:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});