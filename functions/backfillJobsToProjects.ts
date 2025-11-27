import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all completed jobs that have a project_id
    const completedJobs = await base44.entities.Job.filter({
      status: 'Completed',
      project_id: { $exists: true, $ne: null }
    });

    const results = {
      total: completedJobs.length,
      synced: 0,
      errors: []
    };

    for (const job of completedJobs) {
      try {
        // Get job summaries
        const jobSummaries = await base44.entities.JobSummary.filter(
          { job_id: job.id }, 
          '-check_out_time'
        );
        const latestSummary = jobSummaries[0];

        // Fetch current project
        const project = await base44.entities.Project.get(job.project_id);
        if (!project) continue;

        // Merge images
        const existingImages = project.image_urls || [];
        const jobImages = job.image_urls || latestSummary?.photo_urls || [];
        const mergedImages = [...new Set([...existingImages, ...jobImages])];

        // Build project update
        const projectUpdate = {
          image_urls: mergedImages
        };

        // Only update ISV fields if they're not already set, to preserve original ISV data
        if (!project.initial_visit_job_id) {
          projectUpdate.initial_visit_job_id = job.id;
          projectUpdate.initial_visit_overview = job.overview || latestSummary?.overview || null;
          projectUpdate.initial_visit_next_steps = job.next_steps || latestSummary?.next_steps || null;
          projectUpdate.initial_visit_customer_communication = job.communication_with_client || latestSummary?.communication_with_client || null;
          projectUpdate.initial_visit_measurements = job.measurements || latestSummary?.measurements || null;
          projectUpdate.initial_visit_image_urls = jobImages;
          projectUpdate.initial_visit_outcome = job.outcome || latestSummary?.outcome || null;
          projectUpdate.initial_visit_completed_at = latestSummary?.check_out_time || job.updated_date || null;
          projectUpdate.initial_visit_technician_name = latestSummary?.technician_name || null;
        }

        // Sync Xero invoice
        if (job.xero_invoice_id) {
          const existingXeroInvoices = project.xero_invoices || [];
          if (!existingXeroInvoices.includes(job.xero_invoice_id)) {
            projectUpdate.xero_invoices = [...existingXeroInvoices, job.xero_invoice_id];
          }
          if (job.xero_payment_url && !project.xero_payment_url) {
            projectUpdate.xero_payment_url = job.xero_payment_url;
          }
        }

        await base44.entities.Project.update(job.project_id, projectUpdate);
        results.synced++;
      } catch (err) {
        results.errors.push({ job_id: job.id, error: err.message });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});