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
        
        console.log(`Found ${jobs.length} jobs for Vernon project`);
        
        const updates = [];
        
        for (const job of jobs) {
            console.log(`Job ${job.id}: job_number="${job.job_number}" (type: ${typeof job.job_number})`);
            
            if (job.job_number) {
                const jobNumberStr = String(job.job_number).trim();
                
                // Check if it starts with 5001 followed by hyphen
                if (jobNumberStr.startsWith('5001-')) {
                    const suffix = jobNumberStr.substring(5); // Everything after "5001-"
                    const newJobNumber = `4634-${suffix}`;
                    
                    console.log(`Updating: ${jobNumberStr} -> ${newJobNumber}`);
                    
                    await base44.asServiceRole.entities.Job.update(job.id, { 
                        job_number: newJobNumber,
                        project_number: 4634
                    });
                    
                    updates.push({
                        oldNumber: jobNumberStr,
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