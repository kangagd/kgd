import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Fetching all projects...');
    const allProjects = await base44.asServiceRole.entities.Project.list();

    // Find projects with completed_date but status !== "Completed"
    const projectsToFix = allProjects.filter(p => 
      p.completed_date && p.status !== 'Completed' && !p.deleted_at
    );

    console.log(`Found ${projectsToFix.length} projects with completed_date but not in Completed status`);

    if (projectsToFix.length === 0) {
      return Response.json({
        success: true,
        message: 'No projects need fixing',
        projectsFixed: 0
      });
    }

    let fixedCount = 0;
    const results = [];

    for (const project of projectsToFix) {
      try {
        await base44.asServiceRole.entities.Project.update(project.id, {
          completed_date: null
        });

        fixedCount++;
        results.push({
          project_id: project.id,
          project_number: project.project_number,
          title: project.title,
          status: project.status,
          previous_completed_date: project.completed_date
        });

        console.log(`Cleared completed_date from project ${project.project_number} (${project.status})`);
      } catch (error) {
        console.error(`Error updating project ${project.id}:`, error);
        results.push({
          project_id: project.id,
          project_number: project.project_number,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      projectsFixed: fixedCount,
      totalFound: projectsToFix.length,
      results
    });

  } catch (error) {
    console.error('Error in clearCompletedDatesFromOpenProjects:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});