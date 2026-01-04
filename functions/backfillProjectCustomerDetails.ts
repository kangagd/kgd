import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all projects with customer_id but missing any customer details
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const projectsNeedingUpdate = allProjects.filter(p => 
      p.customer_id && (!p.customer_name || !p.customer_phone || !p.customer_email)
    );

    console.log(`Found ${projectsNeedingUpdate.length} projects needing customer details`);

    let updatedCount = 0;
    let failedCount = 0;
    const failed = [];

    for (const project of projectsNeedingUpdate) {
      try {
        // Fetch customer details
        const customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
        
        // Update project with customer details
        await base44.asServiceRole.entities.Project.update(project.id, {
          customer_name: customer.name,
          customer_phone: customer.phone || null,
          customer_email: customer.email || null
        });

        updatedCount++;
        console.log(`Updated project ${project.project_number} with customer: ${customer.name}`);

      } catch (error) {
        failedCount++;
        failed.push({
          project_id: project.id,
          project_number: project.project_number,
          customer_id: project.customer_id,
          error: error.message
        });
        console.error(`Failed to update project ${project.project_number}:`, error.message);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      total_projects_needing_update: projectsNeedingUpdate.length,
      updated: updatedCount,
      failed: failedCount,
      failed_details: failed
    });

  } catch (error) {
    console.error('Error backfilling customer details:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});