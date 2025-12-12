import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Auth check
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all jobs 
        const allJobs = await base44.asServiceRole.entities.Job.list();
        
        // Filter jobs that start with 5001 (with or without hyphen) and are linked to Vernon project
        const jobs = allJobs.filter(j => {
            const jobNum = String(j.job_number || '').trim();
            return (jobNum.startsWith('5001-') || jobNum.startsWith('5001')) && j.project_name?.includes('Vernon');
        });
        
        console.log(`Found ${jobs.length} jobs for Vernon project:`, jobs.map(j => ({id: j.id, num: j.job_number, name: j.project_name})));
        
        const updates = [];
        
        for (const job of jobs) {
            console.log(`Job ${job.id}: job_number="${job.job_number}" (type: ${typeof job.job_number}), project_name="${job.project_name}"`);
            
            if (job.job_number) {
                const jobNumberStr = String(job.job_number).trim();
                let newJobNumber = null;
                
                // Handle "5001-A" format
                if (jobNumberStr.startsWith('5001-')) {
                    const suffix = jobNumberStr.substring(5); // Everything after "5001-"
                    newJobNumber = `4634-${suffix}`;
                }
                // Handle "5001A" format (no hyphen)
                else if (jobNumberStr.startsWith('5001') && jobNumberStr.length > 4) {
                    const suffix = jobNumberStr.substring(4); // Everything after "5001"
                    // Only update if suffix is a letter
                    if (/^[A-Z]$/.test(suffix)) {
                        newJobNumber = `4634${suffix}`;
                    }
                }
                
                if (newJobNumber) {
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