import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch all jobs as service role to bypass RLS restrictions
        // Removed limit param to ensure default behavior if param is causing issues
        const allJobs = await base44.asServiceRole.entities.Job.list(); 

        // Filter out deleted and cancelled jobs on the backend
        // This ensures we don't send unnecessary data and fixes the "duplication" issue (deleted vs active)
        const activeJobs = allJobs.filter(job => !job.deleted_at && job.status !== "Cancelled");

        return Response.json(activeJobs);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});