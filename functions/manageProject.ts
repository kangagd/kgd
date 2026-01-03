import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, data } = await req.json();

        let project;

        if (action === 'create') {
            let projectData = { ...data };

            // Auto-assign project number only if not provided
            if (!projectData.project_number) {
                const existingProjects = await base44.asServiceRole.entities.Project.list('-project_number', 1);
                const lastProjectNumber = existingProjects.length > 0 && existingProjects[0].project_number 
                    ? existingProjects[0].project_number 
                    : 4999;
                projectData.project_number = lastProjectNumber + 1;
            }

            // Auto-link contract logic
            if (projectData.customer_id) {
                try {
                    const customer = await base44.asServiceRole.entities.Customer.get(projectData.customer_id);
                    if (customer && customer.contract_id) {
                        projectData.contract_id = customer.contract_id;
                        projectData.organisation_id = customer.organisation_id;
                    }
                } catch (e) {
                    console.error("Error auto-linking contract to project:", e);
                }
            }

            // Resolve and cache organisation_name if organisation_id is present
            if (projectData.organisation_id) {
                try {
                    const organisation = await base44.asServiceRole.entities.Organisation.get(projectData.organisation_id);
                    if (organisation) {
                        projectData.organisation_name = organisation.name;
                    }
                } catch (e) {
                    console.error("Error resolving organisation name:", e);
                }
            }

            project = await base44.asServiceRole.entities.Project.create(projectData);
            
            // Set last_activity_at to created_date
            await base44.asServiceRole.entities.Project.update(project.id, {
                last_activity_at: project.created_date
            });
            
            // Refetch to get updated data
            project = await base44.asServiceRole.entities.Project.get(project.id);
        } else if (action === 'update') {
            // Check if project_number is being updated
            const oldProject = data.project_number ? await base44.asServiceRole.entities.Project.get(id) : null;
            const oldProjectNumber = oldProject?.project_number;
            const newProjectNumber = data.project_number;
            
            project = await base44.asServiceRole.entities.Project.update(id, data);
            
            // Sync cached fields to related jobs
            const fieldsToSync = {};
            if (data.title !== undefined) fieldsToSync.project_name = data.title;
            if (data.customer_name !== undefined) fieldsToSync.customer_name = data.customer_name;
            if (data.customer_phone !== undefined) fieldsToSync.customer_phone = data.customer_phone;
            if (data.customer_email !== undefined) fieldsToSync.customer_email = data.customer_email;
            if (data.customer_type !== undefined) fieldsToSync.customer_type = data.customer_type;
            if (data.address_full !== undefined) fieldsToSync.address_full = data.address_full;
            if (data.address_street !== undefined) fieldsToSync.address_street = data.address_street;
            if (data.address_suburb !== undefined) fieldsToSync.address_suburb = data.address_suburb;
            if (data.address_state !== undefined) fieldsToSync.address_state = data.address_state;
            if (data.address_postcode !== undefined) fieldsToSync.address_postcode = data.address_postcode;
            if (data.address_country !== undefined) fieldsToSync.address_country = data.address_country;
            if (data.google_place_id !== undefined) fieldsToSync.google_place_id = data.google_place_id;
            if (data.latitude !== undefined) fieldsToSync.latitude = data.latitude;
            if (data.longitude !== undefined) fieldsToSync.longitude = data.longitude;
            
            if (Object.keys(fieldsToSync).length > 0) {
                try {
                    const relatedJobs = await base44.asServiceRole.entities.Job.filter({ project_id: id });
                    await Promise.all(
                        relatedJobs.map(job => 
                            base44.asServiceRole.entities.Job.update(job.id, fieldsToSync)
                        )
                    );
                } catch (e) {
                    console.error("Error syncing project fields to jobs:", e);
                }
            }
            
            // Update related job numbers if project number changed
            if (oldProjectNumber && newProjectNumber && oldProjectNumber !== newProjectNumber) {
                console.log(`Updating job numbers: ${oldProjectNumber} -> ${newProjectNumber}`);
                try {
                    const relatedJobs = await base44.asServiceRole.entities.Job.filter({ project_id: id });
                    console.log(`Found ${relatedJobs.length} related jobs`);
                    
                    for (const job of relatedJobs) {
                        if (job.job_number) {
                            const jobNumberStr = String(job.job_number).trim();
                            const oldProjectStr = String(oldProjectNumber).trim();
                            
                            console.log(`Checking job ${job.id}: "${jobNumberStr}" against old project number "${oldProjectStr}"`);
                            
                            // Handle both formats: "5001-A" and "5001A"
                            let newJobNumber = null;
                            
                            // Format with hyphen: "5001-A"
                            if (jobNumberStr.includes('-') && jobNumberStr.startsWith(oldProjectStr + '-')) {
                                const suffix = jobNumberStr.substring(oldProjectStr.length + 1);
                                newJobNumber = `${newProjectNumber}-${suffix}`;
                            }
                            // Format without hyphen: "5001A" 
                            else if (jobNumberStr.startsWith(oldProjectStr) && jobNumberStr.length > oldProjectStr.length) {
                                const suffix = jobNumberStr.substring(oldProjectStr.length);
                                // Only update if suffix is a letter (like A, B, C) to avoid false matches
                                if (/^[A-Z]$/.test(suffix)) {
                                    newJobNumber = `${newProjectNumber}${suffix}`;
                                }
                            }
                            
                            if (newJobNumber) {
                                console.log(`Updating job ${job.id}: ${jobNumberStr} -> ${newJobNumber}`);
                                
                                await base44.asServiceRole.entities.Job.update(job.id, { 
                                    job_number: newJobNumber,
                                    project_number: newProjectNumber
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error updating related job numbers:", e);
                }
            }
            
            // Update activity timestamp whenever project is updated
            await updateProjectActivity(base44, id, 'Project Updated');

            // Auto-decline quotes if project is lost
            if (data.status === 'Lost') {
                try {
                    const quotes = await base44.asServiceRole.entities.Quote.filter({ project_id: id });
                    const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
                    
                    for (const quote of quotes) {
                        // Only decline if not already accepted or declined
                        if (quote.status !== 'Declined' && quote.status !== 'Accepted') {
                            await base44.asServiceRole.entities.Quote.update(quote.id, { 
                                status: 'Declined',
                                declined_at: new Date().toISOString()
                            });

                            if (quote.pandadoc_document_id && PANDADOC_API_KEY) {
                                try {
                                    // Status 12 = Declined, 11 = Expired/Voided
                                    await fetch(`https://api.pandadoc.com/public/v1/documents/${quote.pandadoc_document_id}/status`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `API-Key ${PANDADOC_API_KEY}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({ status: 12 })
                                    });
                                } catch (pdError) {
                                    console.error(`Error updating PandaDoc status for quote ${quote.id}:`, pdError);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error auto-declining quotes:", e);
                }
            }
        } else if (action === 'delete') {
            // Get project before deletion to check for linked email thread
            const projectToDelete = await base44.asServiceRole.entities.Project.get(id);
            
            // Unlink from any email threads
            if (projectToDelete?.source_email_thread_id) {
                try {
                    await base44.asServiceRole.entities.EmailThread.update(projectToDelete.source_email_thread_id, {
                        linked_project_id: null,
                        linked_project_title: null
                    });
                } catch (error) {
                    console.error('Error unlinking email thread:', error);
                }
            }
            
            // Soft delete the project
            project = await base44.asServiceRole.entities.Project.update(id, { 
                deleted_at: new Date().toISOString() 
            });
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        return Response.json({ success: true, project });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});