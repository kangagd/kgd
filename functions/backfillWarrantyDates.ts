import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all projects with Warranty status
    const projects = await base44.asServiceRole.entities.Project.list();
    const warrantyProjects = projects.filter(p => 
      p.status === 'Warranty' && 
      !p.deleted_at &&
      p.completed_date &&
      !p.warranty_start_date
    );

    let updatedCount = 0;

    for (const project of warrantyProjects) {
      const warrantyDuration = project.warranty_duration_months || 12;
      const startDate = new Date(project.completed_date);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + warrantyDuration);

      const updates = {
        warranty_start_date: startDate.toISOString().split('T')[0],
        warranty_end_date: endDate.toISOString().split('T')[0],
        warranty_status: endDate > new Date() ? 'Active' : 'Expired'
      };

      await base44.asServiceRole.entities.Project.update(project.id, updates);
      updatedCount++;
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      updatedCount,
      message: `Updated ${updatedCount} projects with warranty dates`
    });

  } catch (error) {
    console.error('Error backfilling warranty dates:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});