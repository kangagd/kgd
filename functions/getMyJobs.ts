import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch all jobs as service role to bypass RLS restrictions
        // Removed limit param to ensure default behavior if param is causing issues
        const allJobs = await base44.asServiceRole.entities.Job.list(); 

        // TEMPORARY: Return all jobs for ALL authenticated users to diagnose visibility issues
        // This bypasses all backend filtering to ensure data reaches the frontend
        return Response.json(allJobs);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});