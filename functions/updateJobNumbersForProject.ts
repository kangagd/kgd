import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { project_id, old_project_number, new_project_number } = await req.json();
        
        if (!project_id || !old_project_number || !new_project_number) {
            return Response.json({ 
                error: 'Missing required fields: project_id, old_project_number, new_project_number' 
            }, { status: 400 });
        }

        const response = await base44.functions.invoke('getMyJobs');
        const allJobs = response.data || [];
        const relatedJobs = allJobs.filter(j => j.project_id === project_id && !j.deleted_at);
        const updatedJobs = [];
        
        console.log('Found jobs for project:', relatedJobs.length);
        
        for (const job of relatedJobs) {
            console.log('Checking job:', job.id, 'job_number:', job.job_number, 'type:', typeof job.job_number);
            
            if (job.job_number) {
                const jobNumberStr = String(job.job_number);
                const parts = jobNumberStr.split('-');
                
                console.log('Job number parts:', parts, 'comparing', parts[0], 'with', String(old_project_number));
                
                // Check if job number starts with old project number and has a suffix
                if (parts.length > 1 && parts[0] === String(old_project_number)) {
                    const suffix = parts.slice(1).join('-');
                    const newJobNumber = `${new_project_number}-${suffix}`;
                    
                    console.log('Updating job', job.id, 'from', jobNumberStr, 'to', newJobNumber);
                    
                    await base44.asServiceRole.entities.Job.update(job.id, { 
                        job_number: newJobNumber,
                        project_number: new_project_number
                    });
                    
                    updatedJobs.push({
                        id: job.id,
                        old_number: jobNumberStr,
                        new_number: newJobNumber
                    });
                }
            }
        }

        return Response.json({ 
            success: true, 
            updated_count: updatedJobs.length,
            updated_jobs: updatedJobs
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});