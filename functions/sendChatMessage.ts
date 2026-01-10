import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Parse mentions from message text (format: @email@domain.com)
function parseMentions(text) {
  const mentionRegex = /@([^\s@]+@[^\s]+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const email = match[1].trim();
    if (email.includes('@') && !mentions.includes(email)) {
      mentions.push(email);
    }
  }
  return mentions;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, entityId, message } = await req.json();

    if (!type || !entityId || !message || !['project', 'job'].includes(type)) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Enforce access control (same as getChat)
    let canAccess = user.role === 'admin' || user.extended_role === 'manager';

    if (!canAccess && (user.extended_role === 'technician' || user.is_field_technician)) {
      if (type === 'job') {
        canAccess = true;
      } else if (type === 'project') {
        try {
          const project = await base44.asServiceRole.entities.Project.get(entityId);
          canAccess = project && project.assigned_technicians?.includes(user.email);
        } catch {
          canAccess = false;
        }
      }
    }

    if (!canAccess) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse mentions
    const mentionedEmails = parseMentions(message);

    // Validate mentioned users exist
    if (mentionedEmails.length > 0) {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const validEmails = [];
      for (const email of mentionedEmails) {
        const mentionedUser = allUsers.find(u => u.email === email);
        if (mentionedUser) {
          validEmails.push(email);
        }
      }
      // Update mentionedEmails to only contain valid users
      mentionedEmails.length = 0;
      mentionedEmails.push(...validEmails);
    }

    // Create message
    let createdMessage;
    try {
      const messagePayload = {
        message,
        sender_email: user.email,
        sender_name: user.full_name || user.display_name
      };
      
      if (mentionedEmails.length > 0) {
        messagePayload.mentioned_users = mentionedEmails;
      }
      
      if (type === 'project') {
        messagePayload.project_id = entityId;
        createdMessage = await base44.asServiceRole.entities.ProjectMessage.create(messagePayload);
      } else if (type === 'job') {
        messagePayload.job_id = entityId;
        createdMessage = await base44.asServiceRole.entities.JobMessage.create(messagePayload);
      }
    } catch (messageError) {
      console.error('Failed to create message:', messageError);
      throw new Error(`Failed to create message: ${messageError.message}`);
    }

    if (!createdMessage) {
      throw new Error('Message creation failed - no message returned');
    }

    // Create notifications for mentioned users (non-blocking)
    if (mentionedEmails.length > 0) {
      const notifications = mentionedEmails.map(email => ({
        user_email: email,
        title: `${user.full_name || user.display_name} mentioned you`,
        description: message.substring(0, 100),
        type: 'mention',
        entity_type: type,
        entity_id: entityId,
        related_user_email: user.email,
        is_read: false
      }));

      Promise.all(
        notifications.map(notif =>
          base44.asServiceRole.entities.Notification.create(notif).catch(err =>
            console.error('Failed to create notification for', notif.user_email, ':', err)
          )
        )
      ).catch(err => console.error('Notification batch error:', err));
    }

    return Response.json({
      success: true,
      message: {
        id: createdMessage.id,
        message: createdMessage.message,
        created_date: createdMessage.created_date,
        sender_email: createdMessage.sender_email,
        sender_name: createdMessage.sender_name,
        mentioned_users: mentionedEmails
      }
    });
  } catch (error) {
    console.error('sendChatMessage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});