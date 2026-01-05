import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { project_id } = await req.json();

        if (!project_id) {
            return Response.json({ error: 'project_id is required' }, { status: 400 });
        }

        // Get the project
        const project = await base44.asServiceRole.entities.Project.get(project_id);
        
        if (!project) {
            return Response.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get all jobs for this project
        const jobs = await base44.asServiceRole.entities.Job.filter({
            project_id: project_id
        });

        const activeJobs = jobs.filter(j => !j.deleted_at);

        // Update each job with project's address
        let updatedCount = 0;
        for (const job of activeJobs) {
            await base44.asServiceRole.entities.Job.update(job.id, {
                address: project.address_full || project.address,
                address_full: project.address_full || project.address,
                address_street: project.address_street,
                address_suburb: project.address_suburb,
                address_state: project.address_state,
                address_postcode: project.address_postcode,
                address_country: project.address_country || "Australia",
                google_place_id: project.google_place_id,
                latitude: project.latitude,
                longitude: project.longitude
            });
            updatedCount++;
        }

        return Response.json({ 
            success: true, 
            updated_jobs: updatedCount,
            message: `Updated ${updatedCount} job(s) with project address`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});