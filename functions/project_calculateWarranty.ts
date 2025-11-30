import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { addMonths, isAfter, parseISO, format } from 'npm:date-fns@2.30.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { projectId } = await req.json();

        if (!projectId) {
             return Response.json({ error: "Project ID required" }, { status: 400 });
        }

        // Use service role to ensure we can update project regardless of user permissions if triggered by system
        const adminBase44 = base44.asServiceRole;
        
        const project = await adminBase44.entities.Project.get(projectId);
        if (!project) {
            return Response.json({ error: "Project not found" }, { status: 404 });
        }

        // Calculate stats
        const jobs = await adminBase44.entities.Job.filter({ project_id: projectId });
        const quotes = await adminBase44.entities.Quote.filter({ project_id: projectId });
        
        const standardJobs = jobs.filter(j => j.job_category !== 'Logistics');
        const totalJobs = standardJobs.length;
        const completedJobs = standardJobs.filter(j => j.status === 'Completed').length;
        const pendingJobs = standardJobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled').length;
        
        const acceptedQuotes = quotes.filter(q => q.status === 'Accepted');
        const projectValue = acceptedQuotes.reduce((sum, q) => sum + (q.value || 0), 0);

        // Warranty Calculation Logic
        let warrantyExpiryDate = project.warranty_expiry_date;
        let warrantyStatus = project.warranty_status;

        // Only calculate if warranty is enabled and not void
        if (project.warranty_enabled && warrantyStatus !== 'Void') {
             if (project.completed_date) {
                 // Warranty starts on completion date
                 const completionDate = parseISO(project.completed_date);
                 const durationMonths = project.warranty_duration_months || 12;
                 const expiry = addMonths(completionDate, durationMonths);
                 
                 warrantyExpiryDate = format(expiry, 'yyyy-MM-dd');

                 if (isAfter(expiry, new Date())) {
                     warrantyStatus = 'Active';
                 } else {
                     warrantyStatus = 'Expired';
                 }
             } else {
                 // Project not completed yet
                 warrantyStatus = 'None';
                 warrantyExpiryDate = null;
             }
        }

        // Update Project
        await adminBase44.entities.Project.update(projectId, {
            total_jobs: totalJobs,
            completed_jobs: completedJobs,
            pending_jobs: pendingJobs,
            project_value: projectValue,
            warranty_status: warrantyStatus,
            warranty_expiry_date: warrantyExpiryDate
        });

        return Response.json({ 
            success: true, 
            warranty_status: warrantyStatus,
            warranty_expiry_date: warrantyExpiryDate,
            stats: {
                total_jobs: totalJobs,
                completed_jobs: completedJobs,
                pending_jobs: pendingJobs,
                project_value: projectValue
            }
        });

    } catch (error) {
        console.error("Error in project_calculateWarranty:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});