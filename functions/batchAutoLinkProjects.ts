import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batchSize = 5 } = await req.json();

    // Find projects without linked emails
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const activeProjects = allProjects.filter(p => !p.deleted_at);
    
    // Filter to projects without primary_email_thread_id
    const projectsNeedingEmails = activeProjects.filter(p => !p.primary_email_thread_id);
    
    console.log(`Found ${projectsNeedingEmails.length} projects without linked emails`);

    if (projectsNeedingEmails.length === 0) {
      return Response.json({
        success: true,
        message: 'All projects already have linked emails',
        projectsProcessed: 0
      });
    }

    // Take first batch
    const batch = projectsNeedingEmails.slice(0, batchSize);
    console.log(`Processing batch of ${batch.length} projects`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const project of batch) {
      try {
        console.log(`Processing project ${project.project_number}...`);
        
        const result = await base44.asServiceRole.functions.invoke('autoLinkProjectEmails', {
          projectId: project.id
        });

        if (result.data?.success) {
          successCount++;
          results.push({
            project_id: project.id,
            project_number: project.project_number,
            status: 'success',
            ...result.data
          });
        } else {
          failCount++;
          results.push({
            project_id: project.id,
            project_number: project.project_number,
            status: 'failed',
            error: result.data?.error || 'Unknown error'
          });
        }

        // Small delay between projects
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        failCount++;
        results.push({
          project_id: project.id,
          project_number: project.project_number,
          status: 'failed',
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      totalProjectsNeedingEmails: projectsNeedingEmails.length,
      batchSize: batch.length,
      successCount,
      failCount,
      remainingProjects: projectsNeedingEmails.length - batch.length,
      results
    });

  } catch (error) {
    console.error('Error in batchAutoLinkProjects:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});