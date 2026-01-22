/**
 * Centralized job number generation logic
 * SINGLE SOURCE OF TRUTH for job numbering
 */

export async function generateJobNumber(base44, projectId = null) {
    if (projectId) {
        // Project job - use project number with alpha suffix
        const project = await base44.asServiceRole.entities.Project.get(projectId);
        const projectNumber = project.project_number;
        
        // Find highest existing suffix for this project
        const projectJobs = await base44.asServiceRole.entities.Job.filter({ 
            project_id: projectId 
        });
        
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let highestIndex = -1;
        
        for (const job of projectJobs) {
            if (job.job_number) {
                // Extract suffix from job number (e.g., "5000-A" -> "A")
                const parts = job.job_number.split('-');
                if (parts.length === 2) {
                    const suffix = parts[1];
                    const index = alphabet.indexOf(suffix);
                    if (index > highestIndex) {
                        highestIndex = index;
                    }
                }
            }
        }
        
        const nextIndex = highestIndex + 1;
        const suffix = alphabet[nextIndex] || `Z${nextIndex - 25}`;
        
        return `${projectNumber}-${suffix}`;
    } else {
        // Standalone job - query ALL jobs to find highest number
        const allJobs = await base44.asServiceRole.entities.Job.list();
        const allProjects = await base44.asServiceRole.entities.Project.list('-project_number', 1);
        
        // Find highest number used across both projects and standalone jobs
        let highestNumber = 4999;
        
        if (allProjects.length > 0 && allProjects[0].project_number) {
            highestNumber = Math.max(highestNumber, allProjects[0].project_number);
        }
        
        // Check ALL standalone job numbers
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