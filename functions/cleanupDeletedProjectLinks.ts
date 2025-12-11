import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        let cleanedThreads = 0;
        let cleanedJobs = 0;

        // Find all email threads with linked projects
        const threadsWithProjects = await base44.asServiceRole.entities.EmailThread.filter({
            linked_project_id: { $ne: null }
        });

        // Check each linked project
        for (const thread of threadsWithProjects) {
            try {
                const project = await base44.asServiceRole.entities.Project.get(thread.linked_project_id);
                
                // If project is deleted, unlink it
                if (project && project.deleted_at) {
                    await base44.asServiceRole.entities.EmailThread.update(thread.id, {
                        linked_project_id: null,
                        linked_project_title: null
                    });
                    cleanedThreads++;
                }
            } catch (error) {
                // Project not found - unlink it
                if (error.message?.includes('not found') || error.status === 404) {
                    await base44.asServiceRole.entities.EmailThread.update(thread.id, {
                        linked_project_id: null,
                        linked_project_title: null
                    });
                    cleanedThreads++;
                }
            }
        }

        // Find all email threads with linked jobs
        const threadsWithJobs = await base44.asServiceRole.entities.EmailThread.filter({
            linked_job_id: { $ne: null }
        });

        // Check each linked job
        for (const thread of threadsWithJobs) {
            try {
                const job = await base44.asServiceRole.entities.Job.get(thread.linked_job_id);
                
                // If job is deleted, unlink it
                if (job && job.deleted_at) {
                    await base44.asServiceRole.entities.EmailThread.update(thread.id, {
                        linked_job_id: null,
                        linked_job_number: null
                    });
                    cleanedJobs++;
                }
            } catch (error) {
                // Job not found - unlink it
                if (error.message?.includes('not found') || error.status === 404) {
                    await base44.asServiceRole.entities.EmailThread.update(thread.id, {
                        linked_job_id: null,
                        linked_job_number: null
                    });
                    cleanedJobs++;
                }
            }
        }

        return Response.json({ 
            success: true, 
            cleanedThreads,
            cleanedJobs,
            message: `Cleaned ${cleanedThreads} project links and ${cleanedJobs} job links from email threads`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});