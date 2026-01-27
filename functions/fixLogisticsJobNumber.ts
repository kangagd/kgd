import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin only' }, { status: 403 });
        }

        const { job_id, new_job_number } = await req.json();
        
        if (!job_id || !new_job_number) {
            return Response.json({ error: 'job_id and new_job_number required' }, { status: 400 });
        }

        const job = await base44.asServiceRole.entities.Job.get(job_id);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        const updated = await base44.asServiceRole.entities.Job.update(job_id, {
            job_number: new_job_number
        });

        return Response.json({ 
            success: true, 
            old_number: job.job_number,
            new_number: updated.job_number
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});