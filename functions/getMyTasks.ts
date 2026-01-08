import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await base44.asServiceRole.entities.Task.filter({ 
      assigned_to_email: user.email 
    });

    return Response.json({ tasks: tasks || [] });

  } catch (error) {
    console.error('[getMyTasks] Error:', error);
    return Response.json({ 
      tasks: [], 
      error: 'Failed to fetch tasks' 
    }, { status: 200 });
  }
});