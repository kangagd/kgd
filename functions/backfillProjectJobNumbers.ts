import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return Response.json({ error: 'Unauthorized - Admin/Manager only' }, { status: 403 });
        }

        // Get all projects sorted by creation date
        const allProjects = await base44.asServiceRole.entities.Project.list('created_date');
        
        let projectNumber = 5000;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        // Assign project numbers and update project jobs
        for (const project of allProjects) {
            // Assign project number
            await base44.asServiceRole.entities.Project.update(project.id, {
                project_number: projectNumber
            });
            
            // Get jobs for this project sorted by creation date
            const projectJobs = await base44.asServiceRole.entities.Job.filter({ 
                project_id: project.id 
            });
            projectJobs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            
            // Assign alpha suffixes to project jobs
            for (let i = 0; i < projectJobs.length; i++) {
                const suffix = i < 26 ? alphabet[i] : `Z${i - 25}`;
                await base44.asServiceRole.entities.Job.update(projectJobs[i].id, {
                    job_number: `${projectNumber}-${suffix}`,
                    project_number: projectNumber
                });
            }
            
            projectNumber++;
        }
        
        // Handle standalone jobs (no project_id)
        const allJobs = await base44.asServiceRole.entities.Job.list('created_date');
        const standaloneJobs = allJobs.filter(j => !j.project_id);
        
        for (const job of standaloneJobs) {
            await base44.asServiceRole.entities.Job.update(job.id, {
                job_number: String(projectNumber),
                project_number: null
            });
            projectNumber++;
        }
        
        return Response.json({ 
            success: true, 
            projectsUpdated: allProjects.length,
            standaloneJobsUpdated: standaloneJobs.length,
            nextNumber: projectNumber
        });
        
    } catch (error) {
        console.error("Backfill error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});