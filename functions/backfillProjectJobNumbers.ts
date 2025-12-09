import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
        }

        console.log("🔄 Starting backfill of project and job numbers...");

        // Fetch all projects and jobs
        const projects = await base44.asServiceRole.entities.Project.list();
        const jobs = await base44.asServiceRole.entities.Job.list();

        console.log(`Found ${projects.length} projects and ${jobs.length} jobs`);

        // Sort projects by created_date to assign numbers chronologically
        const sortedProjects = projects
            .filter(p => !p.deleted_at)
            .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

        // Assign project numbers starting from 5000
        let projectCounter = 5000;
        const projectNumberMap = {}; // Maps project_id -> project_number

        for (const project of sortedProjects) {
            if (!project.project_number) {
                await base44.asServiceRole.entities.Project.update(project.id, {
                    project_number: projectCounter
                });
                projectNumberMap[project.id] = projectCounter;
                console.log(`✅ Assigned project #${projectCounter} to: ${project.title}`);
                projectCounter++;
            } else {
                projectNumberMap[project.id] = project.project_number;
            }
        }

        // Sort all jobs chronologically (both standalone and project-linked)
        const sortedJobs = jobs
            .filter(j => !j.deleted_at && j.status !== 'Cancelled')
            .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

        // Group jobs by project
        const jobsByProject = {};
        const standaloneJobs = [];

        for (const job of sortedJobs) {
            if (job.project_id) {
                if (!jobsByProject[job.project_id]) {
                    jobsByProject[job.project_id] = [];
                }
                jobsByProject[job.project_id].push(job);
            } else {
                standaloneJobs.push(job);
            }
        }

        // Assign job numbers for project jobs
        for (const [projectId, projectJobs] of Object.entries(jobsByProject)) {
            const projectNumber = projectNumberMap[projectId];
            if (!projectNumber) continue;

            // Sort project jobs by created_date to assign A, B, C chronologically
            const sortedProjectJobs = projectJobs.sort((a, b) => 
                new Date(a.created_date) - new Date(b.created_date)
            );

            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            
            for (let i = 0; i < sortedProjectJobs.length; i++) {
                const job = sortedProjectJobs[i];
                const suffix = alphabet[i] || `Z${i - 25}`; // Handle more than 26 jobs
                const newJobNumber = `${projectNumber}-${suffix}`;
                
                await base44.asServiceRole.entities.Job.update(job.id, {
                    job_number: newJobNumber,
                    project_number: projectNumber
                });
                
                console.log(`✅ Assigned job #${newJobNumber} (Project #${projectNumber})`);
            }
        }

        // Assign job numbers for standalone jobs
        let standaloneCounter = projectCounter; // Continue from where projects left off

        for (const job of standaloneJobs) {
            // Skip if already has a properly formatted job_number
            if (typeof job.job_number === 'string' && !job.job_number.includes('-')) {
                continue;
            }
            
            const newJobNumber = String(standaloneCounter);
            
            await base44.asServiceRole.entities.Job.update(job.id, {
                job_number: newJobNumber,
                project_number: null
            });
            
            console.log(`✅ Assigned standalone job #${newJobNumber}`);
            standaloneCounter++;
        }

        return Response.json({ 
            success: true,
            projects_updated: sortedProjects.length,
            project_jobs_updated: Object.values(jobsByProject).flat().length,
            standalone_jobs_updated: standaloneJobs.length
        });

    } catch (error) {
        console.error("❌ Backfill error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});