import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await req.json();
        if (!projectId) {
            return Response.json({ error: "Project ID is required" }, { status: 400 });
        }

        const project = await base44.entities.Project.get(projectId);
        if (!project) {
            return Response.json({ error: "Project not found" }, { status: 404 });
        }

        const jobs = await base44.entities.Job.filter({ project_id: projectId });
        const parts = await base44.entities.Part.filter({ project_id: projectId });
        const quotes = await base44.entities.Quote.filter({ project_id: projectId });
        const invoices = await base44.entities.XeroInvoice.filter({ project_id: projectId });
        const warrantyIssues = await base44.entities.WarrantyIssue.filter({ project_id: projectId });
        
        // Calculate derived stats
        const standardJobs = jobs.filter(j => j.job_category !== 'Logistics');
        const logisticsJobs = jobs.filter(j => j.job_category === 'Logistics');
        const warrantyJobs = jobs.filter(j => j.is_warranty_job);

        const totalJobs = standardJobs.length;
        const completedJobs = standardJobs.filter(j => j.status === 'Completed').length;
        const pendingJobs = standardJobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled').length;

        const acceptedQuotes = quotes.filter(q => q.status === 'Accepted');
        const projectValue = acceptedQuotes.reduce((sum, q) => sum + (q.value || 0), 0);

        // Organize photos by job
        const photosByJob = {};
        jobs.forEach(job => {
            if (job.image_urls && job.image_urls.length > 0) {
                photosByJob[job.id] = {
                    jobId: job.id,
                    jobName: job.customer_name || `Job #${job.job_number}`, // Fallback
                    jobNumber: job.job_number,
                    technicians: job.assigned_to_name,
                    date: job.scheduled_date,
                    photos: job.image_urls
                };
            }
        });

        const projectPhotos = project.image_urls || [];

        // Check warranty status
        // This should ideally be updated via the project_calculateWarranty function, 
        // but we can double check/recalc here if needed. For now, return stored values.
        
        return Response.json({
            project,
            summary: {
                totalJobs,
                completedJobs,
                pendingJobs,
                projectValue
            },
            jobs: standardJobs,
            logisticsJobs,
            warrantyJobs,
            parts,
            quotes,
            invoices,
            warrantyIssues,
            photosByJob: Object.values(photosByJob),
            projectPhotos
        });

    } catch (error) {
        console.error("Error in project_getSummary:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});