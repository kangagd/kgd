import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
        } else if (action === 'update') {
            project = await base44.asServiceRole.entities.Project.update(id, data);

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
            // Handle unlink email thread logic here if needed, or keep it in frontend/Project.js for now
            // But to be consistent, let's replicate it here if we want to fully move logic. 
            // The frontend `deleteProjectMutation` does unlinking. I should keep it simple for now 
            // and just use this for basic CRUD or move full logic.
            // Since user asked to "Implement logic in backend functions" for auto-linking, 
            // `manageProject` is primarily for that.
            
            if (data && data.deleted_at) {
                 project = await base44.asServiceRole.entities.Project.update(id, { deleted_at: data.deleted_at });
            } else {
                 // Hard delete or soft delete?
                 // Frontend sends { deleted_at: ... } usually for soft delete
                 // If action is delete, assume soft delete or follow passed data
                 await base44.asServiceRole.entities.Project.delete(id); 
                 return Response.json({ success: true });
            }
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        return Response.json({ success: true, project });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});