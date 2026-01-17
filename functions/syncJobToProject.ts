import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Fetch the job
    const job = await base44.entities.Job.get(job_id);

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Only sync if job is connected to a project
    if (!job.project_id) {
      return Response.json({ 
        success: true, 
        message: 'Job is not connected to a project, skipping sync' 
      });
    }

    // Get the latest job summary for this job (most recent checkout)
    const jobSummaries = await base44.entities.JobSummary.filter(
      { job_id: job_id }, 
      '-check_out_time'
    );

    const latestSummary = jobSummaries[0];

    // DEPRECATED: Initial Site Visit concept removed - all visits handled uniformly
    // Kept for backward compatibility - legacy status advance logic
    const isInitialSiteVisit = false;

    // Fetch current project
    const project = await base44.entities.Project.get(job.project_id);

    // Merge images into the project's main image_urls
    const existingImages = project.image_urls || [];
    const jobImages = job.image_urls || latestSummary?.photo_urls || [];
    const mergedImages = [...new Set([...existingImages, ...jobImages])];

    // Build project update - DEPRECATED: no longer sync to initial_visit_* fields
    // All visit data now comes from VisitsTimeline which reads jobs directly
    const projectUpdate = {
      image_urls: mergedImages
      // NOTE: initial_visit_* fields are deprecated (retained for backward compatibility)
      // Do not write to them anymore - all display now sources from jobs/visits
    };

    // Sync Xero invoice to project if job has one
    if (job.xero_invoice_id) {
      const existingXeroInvoices = project.xero_invoices || [];
      if (!existingXeroInvoices.includes(job.xero_invoice_id)) {
        projectUpdate.xero_invoices = [...existingXeroInvoices, job.xero_invoice_id];
      }
      // Also sync the payment URL if available
      if (job.xero_payment_url && !project.xero_payment_url) {
        projectUpdate.xero_payment_url = job.xero_payment_url;
      }
    }

    // DEPRECATED: Status advancement logic disabled (was for legacy Initial Site Visit)
    // Projects now follow standard stage automation rules only

    // Update the project
    await base44.entities.Project.update(job.project_id, projectUpdate);

    return Response.json({
      success: true,
      message: isInitialSiteVisit ? 'Project updated with Initial Site Visit data' : 'Project images synced from job',
      project_id: job.project_id,
      isInitialSiteVisit
    });

  } catch (error) {
    console.error('syncJobToProject error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});