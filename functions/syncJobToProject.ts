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

    // Check if job type is "Initial Site Visit" (case-insensitive check)
    const isInitialSiteVisit = job.job_type_name?.toLowerCase().includes('initial') || 
                               job.job_type_name?.toLowerCase().includes('site visit') ||
                               job.job_type_name?.toLowerCase() === 'isv';

    // Fetch current project
    const project = await base44.entities.Project.get(job.project_id);

    // Merge images into the project's main image_urls
    const existingImages = project.image_urls || [];
    const jobImages = job.image_urls || latestSummary?.photo_urls || [];
    const mergedImages = [...new Set([...existingImages, ...jobImages])];

    // Build project update with all job data
    const projectUpdate = {
      image_urls: mergedImages,
      initial_visit_job_id: job.id,
      initial_visit_overview: job.overview || latestSummary?.overview || null,
      initial_visit_next_steps: job.next_steps || latestSummary?.next_steps || null,
      initial_visit_customer_communication: job.communication_with_client || latestSummary?.communication_with_client || null,
      initial_visit_measurements: job.measurements || latestSummary?.measurements || null,
      initial_visit_image_urls: jobImages,
      initial_visit_outcome: job.outcome || latestSummary?.outcome || null,
      initial_visit_completed_at: latestSummary?.check_out_time || new Date().toISOString(),
      initial_visit_technician_name: latestSummary?.technician_name || null
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

    // If it's an Initial Site Visit and project status is still "Initial Site Visit", advance to next stage
    if (isInitialSiteVisit && project.status === 'Initial Site Visit') {
      projectUpdate.status = 'Create Quote';
    }

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