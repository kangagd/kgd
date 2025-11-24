import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, new_status, old_status, completed_date } = await req.json();

    if (!project_id || !new_status) {
      return Response.json({ error: 'project_id and new_status are required' }, { status: 400 });
    }

    // Only proceed if project is being marked as Completed for the first time
    if (new_status !== 'Completed' || old_status === 'Completed') {
      return Response.json({ 
        message: 'No action needed - project not newly completed',
        warranty_created: false,
        reminder_created: false
      });
    }

    // Get the project
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if warranty is enabled
    if (project.warranty_enabled === false) {
      return Response.json({ 
        message: 'Warranty disabled for this project',
        warranty_created: false,
        reminder_created: false
      });
    }

    // Determine warranty start date
    const warrantyStartDate = completed_date || 
                               project.completed_date || 
                               new Date().toISOString().split('T')[0];

    // Calculate warranty end date (12 months from start)
    const startDate = new Date(warrantyStartDate);
    const endDate = new Date(startDate);
    const durationMonths = project.warranty_duration_months || 12;
    endDate.setMonth(endDate.getMonth() + durationMonths);
    const warrantyEndDate = endDate.toISOString().split('T')[0];

    // Update project with warranty information
    await base44.asServiceRole.entities.Project.update(project_id, {
      warranty_start_date: warrantyStartDate,
      warranty_end_date: warrantyEndDate,
      warranty_duration_months: durationMonths,
      warranty_status: 'Active',
      completed_date: warrantyStartDate
    });

    // Check if a maintenance reminder already exists for this project
    const existingReminders = await base44.asServiceRole.entities.MaintenanceReminder.filter({
      project_id: project_id
    });

    let reminderCreated = false;

    if (existingReminders.length === 0) {
      // Create maintenance reminder
      await base44.asServiceRole.entities.MaintenanceReminder.create({
        project_id: project_id,
        project_title: project.title,
        customer_id: project.customer_id,
        customer_name: project.customer_name,
        customer_email: project.customer_email,
        customer_phone: project.customer_phone,
        reminder_type: 'Maintenance',
        due_date: warrantyEndDate,
        status: 'Pending',
        notes: `12-month maintenance reminder for ${project.title}`,
        is_overdue: false
      });

      reminderCreated = true;
    }

    return Response.json({
      success: true,
      message: 'Project warranty and maintenance reminder configured',
      warranty_created: true,
      reminder_created: reminderCreated,
      warranty_start_date: warrantyStartDate,
      warranty_end_date: warrantyEndDate
    });

  } catch (error) {
    console.error('Error handling project completion:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});