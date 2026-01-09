import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { filterRestrictedFields } from './shared/permissionHelpers.js';

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

    console.log(`[getMyProjects] Fetching projects for user: ${user.email}`);

    // All authenticated users can see all projects (matches Project entity RLS: read = {})
    let projects = [];
    
    try {
      const allProjects = await base44.asServiceRole.entities.Project.list();
      projects = Array.isArray(allProjects) ? allProjects.filter(p => p && !p.deleted_at) : [];
      console.log(`[getMyProjects] Fetched ${projects.length} projects`);
    } catch (fetchError) {
      console.error('[getMyProjects] Failed to fetch projects:', fetchError);
      projects = [];
    }

    // Filter restricted fields for non-admin users
    const filteredProjects = filterRestrictedFields(user, 'Project', projects);
    
    // CRITICAL: Always return valid array structure
    return Response.json({ projects: filteredProjects || [] });
    
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