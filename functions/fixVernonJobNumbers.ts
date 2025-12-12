import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Auth check
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Vernon project (ID from screenshot: 693b7500f1e1f3df79...)
        const vernonProjectId = '693b7500f1e1f3df79c7adde'; // From the screenshot
        
        // Get jobs linked to Vernon project
        const jobs = await base44.asServiceRole.entities.Job.filter({ project_id: vernonProjectId });
        
        const updates = [];
        
        for (const job of jobs) {
            if (job.job_number && typeof job.job_number === 'string') {
                const parts = job.job_number.split('-');
                // If it starts with 5001 and has a suffix
                if (parts.length > 1 && parts[0] === '5001') {
                    const suffix = parts.slice(1).join('-');
                    const newJobNumber = `4634-${suffix}`;
                    
                    await base44.asServiceRole.entities.Job.update(job.id, { 
                        job_number: newJobNumber,
                        project_number: 4634
                    });
                    
                    updates.push({
                        oldNumber: job.job_number,
                        newNumber: newJobNumber
                    });
                }
            }
        }

        return Response.json({
            success: true,
            updated_count: updates.length,
            updated_jobs: updates
        });
        
    } catch (error) {
        console.error('Error fixing Vernon job numbers:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});