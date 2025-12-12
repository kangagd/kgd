import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - admin only' }, { status: 401 });
        }

        const { project_id } = await req.json();
        
        if (!project_id) {
            return Response.json({ error: 'project_id is required' }, { status: 400 });
        }

        // Get the project
        const project = await base44.asServiceRole.entities.Project.get(project_id);
        const projectNumber = project.project_number;
        
        console.log(`Syncing jobs for project ${project_id} with number ${projectNumber}`);

        // Get all jobs for this project
        const jobs = await base44.asServiceRole.entities.Job.filter({ project_id });
        console.log(`Found ${jobs.length} jobs`);

        const updates = [];

        for (const job of jobs) {
            if (job.job_number) {
                const jobNumberStr = String(job.job_number).trim();
                
                // Extract suffix from current job number
                let suffix = null;
                
                // Check for hyphenated format (e.g., "5001-A")
                const hyphenIndex = jobNumberStr.indexOf('-');
                if (hyphenIndex > 0) {
                    suffix = jobNumberStr.substring(hyphenIndex + 1);
                } 
                // Check for non-hyphenated format with letter suffix (e.g., "5001A")
                else {
                    const match = jobNumberStr.match(/^(\d+)([A-Z])$/);
                    if (match) {
                        suffix = match[2];
                    }
                }

                if (suffix) {
                    // Determine format based on original
                    const newJobNumber = hyphenIndex > 0 
                        ? `${projectNumber}-${suffix}`
                        : `${projectNumber}${suffix}`;
                    
                    if (newJobNumber !== jobNumberStr) {
                        console.log(`Updating job ${job.id}: ${jobNumberStr} -> ${newJobNumber}`);
                        
                        await base44.asServiceRole.entities.Job.update(job.id, {
                            job_number: newJobNumber,
                            project_number: projectNumber
                        });
                        
                        updates.push({
                            job_id: job.id,
                            old_number: jobNumberStr,
                            new_number: newJobNumber
                        });
                    }
                }
            }
        }

        return Response.json({
            success: true,
            project_id,
            project_number: projectNumber,
            jobs_updated: updates.length,
            updates
        });

    } catch (error) {
        console.error('Error syncing job numbers:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});