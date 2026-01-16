import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin-only check
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                error: 'Forbidden: Admin access required' 
            }, { status: 403 });
        }

        // Fetch all non-deleted jobs
        const allJobs = await base44.asServiceRole.entities.Job.list();
        const jobs = allJobs.filter(job => !job.deleted_at);

        const report = {
            total_jobs_scanned: jobs.length,
            total_jobs_updated: 0,
            updated_job_ids: [],
            errors: [],
            field_updates: {
                project_name: 0,
                project_number: 0,
                customer_name: 0,
                customer_phone: 0,
                customer_email: 0,
                address_fields: 0
            }
        };

        // Batch fetch projects and customers to minimize API calls
        const projectIds = new Set(jobs.filter(j => j.project_id && !j.project_name).map(j => j.project_id));
        const customerIds = new Set(jobs.filter(j => j.customer_id && !j.customer_name).map(j => j.customer_id));

        const projectCache = new Map();
        const customerCache = new Map();

        // Fetch all needed projects
        for (const projectId of projectIds) {
            try {
                const project = await base44.asServiceRole.entities.Project.get(projectId);
                projectCache.set(projectId, project);
            } catch (error) {
                console.error(`Error fetching project ${projectId}:`, error.message);
            }
        }

        // Fetch all needed customers
        for (const customerId of customerIds) {
            try {
                const customer = await base44.asServiceRole.entities.Customer.get(customerId);
                customerCache.set(customerId, customer);
            } catch (error) {
                console.error(`Error fetching customer ${customerId}:`, error.message);
            }
        }

        // Process each job
        for (const job of jobs) {
            let updateData = {};
            let hasUpdates = false;

            // 1. Repair project_name and project_number
            if (job.project_id && !job.project_name) {
                const project = projectCache.get(job.project_id);
                if (!project) {
                    report.errors.push({
                        job_id: job.id,
                        reason: `Project ${job.project_id} not found for project_name backfill`
                    });
                    continue; // Skip this job if related entity missing
                }
                if (project.title) {
                    updateData.project_name = project.title;
                    report.field_updates.project_name++;
                    hasUpdates = true;
                }
                if (!job.project_number && project.project_number) {
                    updateData.project_number = project.project_number;
                    report.field_updates.project_number++;
                    hasUpdates = true;
                }
            }

            // 2. Repair customer cached fields
            if (job.customer_id && !job.customer_name) {
                const customer = customerCache.get(job.customer_id);
                if (!customer) {
                    report.errors.push({
                        job_id: job.id,
                        reason: `Customer ${job.customer_id} not found for customer_name backfill`
                    });
                    continue; // Skip this job if related entity missing
                }
                if (customer.name) {
                    updateData.customer_name = customer.name;
                    report.field_updates.customer_name++;
                    hasUpdates = true;
                }
                if (!job.customer_phone && customer.phone) {
                    updateData.customer_phone = customer.phone;
                    report.field_updates.customer_phone++;
                    hasUpdates = true;
                }
                if (!job.customer_email && customer.email) {
                    updateData.customer_email = customer.email;
                    report.field_updates.customer_email++;
                    hasUpdates = true;
                }
            }

            // 3. Repair address fields (only if not manually overridden)
            if (job.address_source !== 'manual' && !job.address_full && job.project_id) {
                const project = projectCache.get(job.project_id);
                if (!project) {
                    // Already reported above if customer_id was empty, don't duplicate
                    if (job.customer_id && !job.customer_name) {
                        // Error already recorded
                    } else {
                        report.errors.push({
                            job_id: job.id,
                            reason: `Project ${job.project_id} not found for address backfill`
                        });
                    }
                    continue;
                }
                
                if (project.address_full || project.address) {
                    updateData.address_full = project.address_full || project.address;
                    if (project.address_street) updateData.address_street = project.address_street;
                    if (project.address_suburb) updateData.address_suburb = project.address_suburb;
                    if (project.address_state) updateData.address_state = project.address_state;
                    if (project.address_postcode) updateData.address_postcode = project.address_postcode;
                    if (project.address_country) updateData.address_country = project.address_country;
                    if (project.google_place_id) updateData.google_place_id = project.google_place_id;
                    if (project.latitude) updateData.latitude = project.latitude;
                    if (project.longitude) updateData.longitude = project.longitude;
                    
                    report.field_updates.address_fields++;
                    hasUpdates = true;
                }
            }

            // Apply updates only if there are changes
            if (hasUpdates) {
                try {
                    await base44.asServiceRole.entities.Job.update(job.id, updateData);
                    report.total_jobs_updated++;
                    report.updated_job_ids.push(job.id);

                    // Limit to 100 in report
                    if (report.updated_job_ids.length > 100) {
                        report.updated_job_ids = report.updated_job_ids.slice(0, 100);
                        report.note = 'Updated job IDs limited to 100 in report';
                    }
                } catch (error) {
                    report.errors.push({
                        job_id: job.id,
                        reason: `Failed to update: ${error.message}`
                    });
                }
            }
        }

        return Response.json(report);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});