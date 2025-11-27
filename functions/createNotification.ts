import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This can be called with service role for system notifications
    // or with user auth for user-triggered notifications
    const body = await req.json();
    
    const {
      userEmail,
      userId,
      title,
      body: notificationBody,
      type = 'info',
      relatedEntityType,
      relatedEntityId,
      createdBy
    } = body;

    if (!userEmail || !title) {
      return Response.json({ error: 'userEmail and title are required' }, { status: 400 });
    }

    // Create the notification using service role
    const notification = await base44.asServiceRole.entities.Notification.create({
      user_id: userId || null,
      user_email: userEmail,
      title,
      body: notificationBody || null,
      type,
      related_entity_type: relatedEntityType || null,
      related_entity_id: relatedEntityId || null,
      is_read: false,
      read_at: null
    });

    return Response.json({ 
      success: true, 
      notification 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});