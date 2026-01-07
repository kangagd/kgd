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
      const allProjects = await base44.asServiceRole.entities.Project.filter({
        deleted_at: { $exists: false }
      });
      projects = allProjects;
    } else {
      // Regular users see only their own projects
      const allProjects = await base44.asServiceRole.entities.Project.filter({ 
        created_by: user.email,
        deleted_at: { $exists: false }
      });
      projects = allProjects;
    }

    return Response.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});