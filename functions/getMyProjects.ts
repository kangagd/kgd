import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admins, managers, and regular users to fetch projects
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';

    let projects;
    if (isAdmin || isManager) {
      // Admins and managers can see all projects
      projects = await base44.asServiceRole.entities.Project.list();
    } else {
      // Regular users see only their own projects
      projects = await base44.asServiceRole.entities.Project.filter({ 
        created_by: user.email 
      });
    }

    return Response.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});