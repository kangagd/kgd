import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Auth check - only admin
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { dryRun = true } = await req.json();

        // Fetch jobs. Since we can't easily filter for null project_id in all backends,
        // we'll fetch latest jobs and filter in memory. 
        // Adjust limit as needed for migration size.
        const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500); 
        const legacyJobs = allJobs.filter(j => !j.project_id);

        const report = {
            total_scanned: allJobs.length,
            candidates_found: legacyJobs.length,
            migrated_count: 0,
            dryRun,
            actions: []
        };

        for (const job of legacyJobs) {
            try {
                // Get Customer for contract info
                let customer = null;
                if (job.customer_id) {
                    try {
                        customer = await base44.asServiceRole.entities.Customer.get(job.customer_id);
                    } catch (e) {
                        console.warn(`Customer ${job.customer_id} not found for job ${job.id}`);
                    }
                }

                const dateStr = job.scheduled_date || (job.created_date ? job.created_date.split('T')[0] : new Date().toISOString().split('T')[0]);
                const jobType = job.job_type_name || job.job_type || "Job";
                const customerName = job.customer_name || customer?.name || "Unknown Customer";
                
                const projectTitle = `${customerName} – ${jobType} – ${dateStr}`;

                // Determine Project Type based on Job Type
                let projectType = 'Repair'; // Default
                const typeLower = jobType.toLowerCase();
                if (typeLower.includes('install') && typeLower.includes('gate')) projectType = 'Gate Install';
                else if (typeLower.includes('install') && typeLower.includes('shutter')) projectType = 'Roller Shutter Install';
                else if (typeLower.includes('install')) projectType = 'Garage Door Install';
                else if (typeLower.includes('maintenance')) projectType = 'Maintenance';
                else if (typeLower.includes('motor') || typeLower.includes('accessory')) projectType = 'Motor/Accessory';

                // Determine Contract ID (Job > Customer)
                const contractId = job.contract_id || customer?.contract_id;

                const projectData = {
                    title: projectTitle,
                    customer_id: job.customer_id,
                    customer_name: customerName,
                    customer_phone: job.customer_phone || customer?.phone,
                    customer_email: job.customer_email || customer?.email,
                    organisation_id: job.organisation_id || customer?.organisation_id,
                    contract_id: contractId,
                    address: job.address,
                    address_full: job.address_full,
                    address_street: job.address_street,
                    address_suburb: job.address_suburb,
                    address_state: job.address_state,
                    address_postcode: job.address_postcode,
                    status: job.status === 'Completed' ? 'Completed' : 'Scheduled',
                    project_type: projectType,
                    description: `Auto-created from Legacy Job #${job.job_number}`,
                    summary: `Migrated from Job #${job.job_number}: ${job.overview || ''}`
                };

                if (dryRun) {
                    report.actions.push({
                        action: 'Create Project',
                        job_id: job.id,
                        job_number: job.job_number,
                        proposed_data: projectData
                    });
                } else {
                    const newProject = await base44.asServiceRole.entities.Project.create(projectData);
                    
                    await base44.asServiceRole.entities.Job.update(job.id, {
                        project_id: newProject.id,
                        project_name: newProject.title,
                        contract_id: contractId // Sync contract to job if missing
                    });
                    
                    report.migrated_count++;
                    report.actions.push({
                        action: 'Migrated',
                        job_id: job.id,
                        new_project_id: newProject.id,
                        new_project_title: newProject.title
                    });
                }

            } catch (err) {
                console.error(`Failed to migrate job ${job.id}`, err);
                report.actions.push({
                    action: 'Error',
                    job_id: job.id,
                    error: err.message
                });
            }
        }

        return Response.json(report);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});