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

    const { projectId } = await req.json();
    
    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Use service role to fetch messages for all authenticated users
    const messages = await base44.asServiceRole.entities.ProjectMessage.filter({ 
      project_id: projectId 
    });

    return Response.json({ messages: messages || [] });

  } catch (error) {
    console.error('[getProjectMessages] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});