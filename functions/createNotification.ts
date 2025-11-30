import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    
    const {
      userId,
      title,
      message,
      entityType,
      entityId,
      priority = 'normal'
    } = body;

    if (!userId || !title || !message) {
      return Response.json({ error: 'userId, title, and message are required' }, { status: 400 });
    }

    // Create the notification using service role
    const notification = await base44.asServiceRole.entities.Notification.create({
      user_id: userId,
      title,
      message,
      entity_type: entityType || "Other",
      entity_id: entityId || null,
      priority,
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