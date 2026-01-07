import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // CRITICAL: Validate request method
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    
    // CRITICAL: Authentication check
    const user = await base44.auth.me();
    if (!user || !user.email) {
      console.error('[getMyProjects] Authentication failed - no user or email');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[getMyProjects] Fetching projects for user: ${user.email}, role: ${user.role}, extended_role: ${user.extended_role}`);

    // CRITICAL: Role-based access control
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';

    let projects = [];
    
    if (isAdmin || isManager) {
      // Admins and managers can see all projects (excluding soft-deleted ones)
      try {
        const allProjects = await base44.asServiceRole.entities.Project.filter({});
        projects = Array.isArray(allProjects) ? allProjects.filter(p => p && !p.deleted_at) : [];
        console.log(`[getMyProjects] Admin/Manager fetched ${projects.length} projects`);
      } catch (fetchError) {
        console.error('[getMyProjects] Failed to fetch all projects:', fetchError);
        // FALLBACK: Return empty array rather than failing
        projects = [];
      }
    } else {
      // Regular users see only their own projects (excluding soft-deleted ones)
      try {
        const allProjects = await base44.asServiceRole.entities.Project.filter({ 
          created_by: user.email
        });
        projects = Array.isArray(allProjects) ? allProjects.filter(p => p && !p.deleted_at) : [];
        console.log(`[getMyProjects] User fetched ${projects.length} own projects`);
      } catch (fetchError) {
        console.error('[getMyProjects] Failed to fetch user projects:', fetchError);
        // FALLBACK: Return empty array rather than failing
        projects = [];
      }
    }

    // CRITICAL: Always return valid array structure
    return Response.json({ projects: projects || [] });
    
  } catch (error) {
    console.error('[getMyProjects] CRITICAL ERROR:', error);
    // FALLBACK: Return empty projects rather than 500 to prevent UI breakage
    return Response.json({ 
      projects: [], 
      error: 'Failed to fetch projects',
      _debug: error.message 
    }, { status: 200 });
  }
});