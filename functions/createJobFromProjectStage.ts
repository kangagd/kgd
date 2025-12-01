import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId, jobType } = await req.json();

        if (!projectId || !jobType) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use service role for automation to ensure permissions
        const client = base44.asServiceRole;

        // 1. Fetch Project
        const project = await client.entities.Project.get(projectId);
        if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

        // 2. Get or Create JobType
        // Search by exact name match
        const typeEntities = await client.entities.JobType.list();
        let typeEntity = typeEntities.find(t => t.name.toLowerCase() === jobType.toLowerCase());
        
        if (!typeEntity) {
            // Defaults for new job type
            typeEntity = await client.entities.JobType.create({
                name: jobType,
                category: 'Standard',
                color: '#3B82F6', // Default blue
                is_active: true,
                sort_order: 99
            });
        }

        // 3. Check for existing job
        // We check if there is already a job for this project with this specific type
        // Using filter on project_id and then checking job_type_id in memory to be safe or via filter if supported
        const existingJobs = await client.entities.Job.filter({
            project_id: projectId
        });
        
        const duplicateJob = existingJobs.find(j => j.job_type_id === typeEntity.id && j.status !== 'Cancelled');

        if (duplicateJob) {
             return Response.json({ 
                jobId: duplicateJob.id, 
                message: 'Job already exists',
                alreadyExists: true 
            });
        }

        // 4. Get next job number
        // Find max job_number
        const lastJobs = await client.entities.Job.list({ sort: { job_number: -1 }, limit: 1 });
        let nextJobNumber = 5000;
        if (lastJobs.length > 0 && lastJobs[0].job_number) {
            nextJobNumber = Math.max(5000, lastJobs[0].job_number + 1);
        }

        // 5. Create Job
        const jobData = {
            job_number: nextJobNumber,
            project_id: project.id,
            project_name: project.title,
            customer_id: project.customer_id,
            customer_name: project.customer_name,
            customer_phone: project.customer_phone,
            customer_email: project.customer_email,
            organisation_id: project.organisation_id,
            contract_id: project.contract_id,
            
            // Address
            address: project.address,
            address_full: project.address_full,
            address_street: project.address_street,
            address_suburb: project.address_suburb,
            address_state: project.address_state,
            address_postcode: project.address_postcode,
            address_country: project.address_country,
            google_place_id: project.google_place_id,
            latitude: project.latitude,
            longitude: project.longitude,

            // Details
            job_type_id: typeEntity.id,
            job_type: typeEntity.name, 
            job_type_name: typeEntity.name,
            job_category: typeEntity.category,
            
            status: 'Open',
            
            // Content
            description: project.description,
            overview: project.summary || project.overview || project.description, 
            notes: project.notes,
            
            // Metadata
            product: project.project_type && ['Garage Door', 'Gate', 'Roller Shutter'].includes(project.project_type) ? project.project_type : undefined,
            measurements: project.measurements || (project.doors ? { doors: project.doors } : undefined)
        };

        const newJob = await client.entities.Job.create(jobData);

        return Response.json({ jobId: newJob.id, job: newJob, alreadyExists: false });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});