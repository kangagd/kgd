import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser || currentUser.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { user_email } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    // Get total count of projects (as admin)
    const allProjects = await base44.asServiceRole.entities.Project.list();

    // Get user details
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    const user = users[0];

    // Try to get projects as that user would see them
    // This won't work directly, but let's see what we can diagnose
    
    return Response.json({
      total_projects_in_db: allProjects.length,
      user_role: user.role,
      user_extended_role: user.extended_role,
      user_email: user.email,
      sample_project_creators: allProjects.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title,
        created_by: p.created_by
      })),
      diagnosis: "If extended_role='manager' and projects exist but user sees [], there's an RLS evaluation issue"
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});