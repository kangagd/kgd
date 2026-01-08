/**
 * Centralized job number generation logic
 * SINGLE SOURCE OF TRUTH for job numbering
 */

export async function generateJobNumber(base44, projectId = null) {
    if (projectId) {
        // Project job - use project number with alpha suffix
        const project = await base44.asServiceRole.entities.Project.get(projectId);
        const projectNumber = project.project_number;
        
        // Find existing jobs for this project to determine next suffix
        const projectJobs = await base44.asServiceRole.entities.Job.filter({ 
            project_id: projectId 
        });
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const suffix = alphabet[projectJobs.length] || `Z${projectJobs.length - 25}`;
        
        return `${projectNumber}-${suffix}`;
    } else {
        // Standalone job - use unique number
        const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 1);
        const allProjects = await base44.asServiceRole.entities.Project.list('-project_number', 1);
        
        // Find highest number used across both projects and standalone jobs
        let highestNumber = 4999;
        
        if (allProjects.length > 0 && allProjects[0].project_number) {
            highestNumber = Math.max(highestNumber, allProjects[0].project_number);
        }
        
        // Check existing standalone job numbers
        const standaloneJobs = allJobs.filter(j => !j.project_id && typeof j.job_number === 'string' && !j.job_number.includes('-'));
        for (const job of standaloneJobs) {
            const num = parseInt(job.job_number);
            if (!isNaN(num)) {
                highestNumber = Math.max(highestNumber, num);
            }
        }
        
        return String(highestNumber + 1);
    }
}