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

            // Log creation
            await base44.asServiceRole.entities.ActivityLog.create({
                entity_type: 'Project',
                entity_id: project.id,
                action: 'create',
                after_data: project,
                user_email: user.email,
                user_name: user.full_name,
                details: `Created Project: ${project.title}`
            });
        } else if (action === 'update') {
            const previousProject = await base44.asServiceRole.entities.Project.get(id);
            project = await base44.asServiceRole.entities.Project.update(id, data);

            // Log update
            await base44.asServiceRole.entities.ActivityLog.create({
                entity_type: 'Project',
                entity_id: id,
                action: 'update',
                before_data: previousProject,
                after_data: project,
                user_email: user.email,
                user_name: user.full_name,
                details: `Updated Project: ${project.title}`
            });

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
            
            const beforeDelete = await base44.asServiceRole.entities.Project.get(id);

            if (data && data.deleted_at) {
                 project = await base44.asServiceRole.entities.Project.update(id, { deleted_at: data.deleted_at });
                 
                 // Log soft delete
                 await base44.asServiceRole.entities.ActivityLog.create({
                    entity_type: 'Project',
                    entity_id: id,
                    action: 'delete',
                    before_data: beforeDelete,
                    user_email: user.email,
                    user_name: user.full_name,
                    details: `Deleted Project: ${beforeDelete.title}`
                });

            } else {
                 // Hard delete or soft delete?
                 // Frontend sends { deleted_at: ... } usually for soft delete
                 // If action is delete, assume soft delete or follow passed data
                 await base44.asServiceRole.entities.Project.delete(id); 
                 
                 // Log hard delete
                 await base44.asServiceRole.entities.ActivityLog.create({
                    entity_type: 'Project',
                    entity_id: id,
                    action: 'delete',
                    before_data: beforeDelete,
                    user_email: user.email,
                    user_name: user.full_name,
                    details: `Deleted Project: ${beforeDelete.title}`
                });

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