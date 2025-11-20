import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Automatically updates project status based on job completions and financial status
 * Called when:
 * - A job is marked as completed
 * - Financial status changes
 * - Jobs are created/deleted
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { projectId } = await req.json();

    if (!projectId) {
      return Response.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Get project and all its jobs
    const project = await base44.asServiceRole.entities.Project.get(projectId);
    const allJobs = await base44.asServiceRole.entities.Job.filter({ project_id: projectId });
    const jobs = allJobs.filter(j => !j.deleted_at);

    // Get job types to identify special jobs
    const jobTypes = await base44.asServiceRole.entities.JobType.list();
    const initialSiteVisitType = jobTypes.find(jt => jt.name.toLowerCase().includes('initial') && jt.name.toLowerCase().includes('site'));
    const finalMeasureType = jobTypes.find(jt => jt.name.toLowerCase().includes('final') && jt.name.toLowerCase().includes('measure'));

    let newProjectStatus = project.project_status || "Lead";

    // Check for Initial Site Visit completion
    const initialSiteVisitCompleted = jobs.some(j => 
      j.job_type_id === initialSiteVisitType?.id && 
      (j.job_status === "Completed" || j.status === "completed")
    );

    // Check for Final Measure completion
    const finalMeasureCompleted = jobs.some(j => 
      j.job_type_id === finalMeasureType?.id && 
      (j.job_status === "Completed" || j.status === "completed")
    );

    // Check if any installation job is scheduled
    const installationScheduled = jobs.some(j => 
      j.job_status === "Scheduled" || j.status === "scheduled"
    );

    // Check if all jobs are completed or cancelled
    const allJobsComplete = jobs.length > 0 && jobs.every(j => 
      j.job_status === "Completed" || j.job_status === "Cancelled" || 
      j.status === "completed" || j.status === "cancelled"
    );

    // Progress project status based on job completions
    if (initialSiteVisitCompleted && (newProjectStatus === "Lead" || !newProjectStatus)) {
      newProjectStatus = "Initial Site Visit";
    }

    if (project.quote_sent_date && ["Lead", "Initial Site Visit"].includes(newProjectStatus)) {
      newProjectStatus = "Quote Sent";
    }

    if (project.quote_approved_date && ["Lead", "Initial Site Visit", "Quote Sent"].includes(newProjectStatus)) {
      newProjectStatus = "Quote Approved";
    }

    if (finalMeasureCompleted && ["Lead", "Initial Site Visit", "Quote Sent", "Quote Approved"].includes(newProjectStatus)) {
      newProjectStatus = "Final Measure";
    }

    if (project.parts_ordered_date && ["Lead", "Initial Site Visit", "Quote Sent", "Quote Approved", "Final Measure"].includes(newProjectStatus)) {
      newProjectStatus = "Parts Ordered";
    }

    if (installationScheduled && ["Lead", "Initial Site Visit", "Quote Sent", "Quote Approved", "Final Measure", "Parts Ordered"].includes(newProjectStatus)) {
      newProjectStatus = "Scheduled";
    }

    // Check for completion: all jobs done AND balance paid
    if (allJobsComplete && project.financial_status === "Balance paid in full") {
      newProjectStatus = "Completed";
      
      // Set completion date if not already set
      if (!project.completed_date) {
        await base44.asServiceRole.entities.Project.update(projectId, {
          completed_date: new Date().toISOString().split('T')[0],
          project_status: newProjectStatus
        });
        
        return Response.json({ 
          success: true, 
          projectStatus: newProjectStatus,
          completionDateSet: true
        });
      }
    }

    // Update project status if it changed
    if (newProjectStatus !== project.project_status) {
      await base44.asServiceRole.entities.Project.update(projectId, {
        project_status: newProjectStatus
      });
    }

    return Response.json({ 
      success: true, 
      projectStatus: newProjectStatus,
      previousStatus: project.project_status
    });

  } catch (error) {
    console.error('Error updating project status:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});