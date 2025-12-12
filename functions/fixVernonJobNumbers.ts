import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get all jobs via direct entity access
        const jobs = await base44.asServiceRole.entities.Job.list();
        
        console.log('Total jobs fetched:', jobs.length);
        
        // Find jobs with 5001-A or 5001-B
        const jobsToUpdate = jobs.filter(j => {
            const jn = String(j.job_number || '');
            return jn.startsWith('5001-');
        });
        
        console.log('Jobs starting with 5001-:', jobsToUpdate.length);
        console.log('Job details:', jobsToUpdate.map(j => ({
            id: j.id,
            job_number: j.job_number,
            project_id: j.project_id
        })));
        
        const updated = [];
        
        for (const job of jobsToUpdate) {
            const oldNumber = String(job.job_number);
            const suffix = oldNumber.substring(5); // Everything after "5001-"
            const newNumber = `4634${suffix}`;
            
            await base44.asServiceRole.entities.Job.update(job.id, {
                job_number: newNumber,
                project_number: 4634
            });
            
            updated.push({
                id: job.id,
                old: oldNumber,
                new: newNumber
            });
        }
        
        return Response.json({
            success: true,
            updated_count: updated.length,
            updated_jobs: updated
        });
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});