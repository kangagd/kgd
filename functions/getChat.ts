import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, entityId } = await req.json();

    if (!type || !entityId || !['project', 'job'].includes(type)) {
      return Response.json({ error: 'Invalid type or entityId' }, { status: 400 });
    }

    // Enforce access control
    let canAccess = user.role === 'admin' || user.extended_role === 'manager';

    if (!canAccess && (user.extended_role === 'technician' || user.is_field_technician)) {
      if (type === 'job') {
        canAccess = true; // Technicians can read jobs
      } else if (type === 'project') {
        // Technicians can read projects they're assigned to
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

    // Fetch messages
    let messages = [];
    if (type === 'project') {
      messages = await base44.asServiceRole.entities.ProjectMessage.filter(
        { project_id: entityId },
        'created_date'
      );
    } else if (type === 'job') {
      messages = await base44.asServiceRole.entities.JobMessage.filter(
        { job_id: entityId },
        'created_date'
      );
    }

    return Response.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        message: m.message,
        created_date: m.created_date,
        sender_email: m.sender_email,
        sender_name: m.sender_name,
        mentioned_users: m.mentioned_users || []
      })),
      canPost: true
    });
  } catch (error) {
    console.error('getChat error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});