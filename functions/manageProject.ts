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

            // Auto-assign project number
            const existingProjects = await base44.asServiceRole.entities.Project.list('-project_number', 1);
            const lastProjectNumber = existingProjects.length > 0 && existingProjects[0].project_number 
                ? existingProjects[0].project_number 
                : 4999;
            projectData.project_number = lastProjectNumber + 1;

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
            
            // Update related job numbers if project number changed
            if (oldProjectNumber && newProjectNumber && oldProjectNumber !== newProjectNumber) {
                try {
                    const relatedJobs = await base44.asServiceRole.entities.Job.filter({ project_id: id });
                    for (const job of relatedJobs) {
                        if (job.job_number) {
                            const jobNumberStr = String(job.job_number);
                            const parts = jobNumberStr.split('-');
                            if (parts.length > 1 && parts[0] === String(oldProjectNumber)) {
                                // Keep the suffix, update the prefix
                                const suffix = parts.slice(1).join('-');
                                const newJobNumber = `${newProjectNumber}-${suffix}`;
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