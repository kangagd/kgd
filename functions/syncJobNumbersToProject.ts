import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - admin only' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { project_id } = body;
        
        let projects = [];
        
        if (project_id) {
            // Single project mode
            const project = await base44.asServiceRole.entities.Project.get(project_id);
            projects = [project];
            console.log(`Syncing single project ${project_id}`);
        } else {
            // Batch mode - sync all projects
            projects = await base44.asServiceRole.entities.Project.list();
            console.log(`Syncing all ${projects.length} projects`);
        }

        const updates = [];
        let totalJobsUpdated = 0;

        for (const project of projects) {
            if (!project.project_number) continue;
            
            const projectNumber = project.project_number;
            const jobs = await base44.asServiceRole.entities.Job.filter({ project_id: project.id });
            
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
                            project_id: project.id,
                            project_number: projectNumber,
                            job_id: job.id,
                            old_number: jobNumberStr,
                            new_number: newJobNumber
                        });
                        
                        totalJobsUpdated++;
                    }
                }
            }
            }
        }

        return Response.json({
            success: true,
            mode: project_id ? 'single' : 'batch',
            projects_processed: projects.length,
            jobs_updated: totalJobsUpdated,
            updates
        });

    } catch (error) {
        console.error('Error syncing job numbers:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});