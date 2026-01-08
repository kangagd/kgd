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

    // Load the project to check access
    const project = await base44.asServiceRole.entities.Project.get(projectId);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check access: admin, manager, viewer, assigned technician, or creator
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';
    const isViewer = user.extended_role === 'viewer';
    const isAssigned = project.assigned_technicians && project.assigned_technicians.includes(user.email);
    const isCreator = project.created_by === user.email;

    if (!isAdmin && !isManager && !isViewer && !isAssigned && !isCreator) {
      return Response.json({ error: 'You do not have access to this project' }, { status: 403 });
    }

    // Fetch messages using service role
    const messages = await base44.asServiceRole.entities.ProjectMessage.filter({ 
      project_id: projectId 
    });

    return Response.json({ messages: messages || [] });

  } catch (error) {
    console.error('[getProjectMessages] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});