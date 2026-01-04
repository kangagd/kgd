import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all projects with Warranty status or Completed status
    const projects = await base44.asServiceRole.entities.Project.list();
    const warrantyProjects = projects.filter(p => 
      (p.status === 'Warranty' || p.status === 'Completed') && 
      !p.deleted_at &&
      p.completed_date
    );

    let updatedCount = 0;
    let skippedCount = 0;

    for (const project of warrantyProjects) {
      const completedDate = new Date(project.completed_date);
      
      // Skip if invalid date
      if (isNaN(completedDate.getTime())) {
        console.log(`Skipping project ${project.id}: invalid completed_date`);
        skippedCount++;
        continue;
      }

      const warrantyDuration = project.warranty_duration_months || 12;
      const warrantyEndDate = new Date(completedDate);
      warrantyEndDate.setMonth(warrantyEndDate.getMonth() + warrantyDuration);

      const today = new Date();
      const isActive = warrantyEndDate > today;

      const updates = {
        warranty_start_date: project.completed_date,
        warranty_end_date: warrantyEndDate.toISOString().split('T')[0],
        warranty_status: isActive ? 'Active' : 'Expired'
      };

      await base44.asServiceRole.entities.Project.update(project.id, updates);
      updatedCount++;
      console.log(`Updated project ${project.id}: warranty ${isActive ? 'Active' : 'Expired'} until ${updates.warranty_end_date}`);
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      updatedCount,
      skippedCount,
      message: `Updated ${updatedCount} projects with warranty dates (skipped ${skippedCount} with invalid dates)`
    });

  } catch (error) {
    console.error('Error backfilling warranty dates:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});