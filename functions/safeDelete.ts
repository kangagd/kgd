import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Safe Delete Function - Validates dependencies before allowing deletions
 * Supports: Customer, Project, Job, Organisation
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Only admins can delete
        if (user.role !== 'admin') {
            return Response.json({ error: 'Only admins can delete records' }, { status: 403 });
        }

        const { entity_type, entity_id } = await req.json();

        if (!entity_type || !entity_id) {
            return Response.json({ error: 'Entity type and ID are required' }, { status: 400 });
        }

        // Validate entity_type
        const validTypes = ['Customer', 'Project', 'Job', 'Organisation', 'PriceListItem'];
        if (!validTypes.includes(entity_type)) {
            return Response.json({ error: `Invalid entity type: ${entity_type}` }, { status: 400 });
        }

        let dependencies = [];
        let canDelete = true;

        // Check dependencies based on entity type
        if (entity_type === 'Customer') {
            const projects = await base44.asServiceRole.entities.Project.filter({ 
                customer_id: entity_id,
                deleted_at: { $exists: false }
            });
            const jobs = await base44.asServiceRole.entities.Job.filter({ 
                customer_id: entity_id,
                deleted_at: { $exists: false }
            });
            
            if (projects.length > 0) {
                dependencies.push(`${projects.length} active project(s)`);
                canDelete = false;
            }
            if (jobs.length > 0) {
                dependencies.push(`${jobs.length} active job(s)`);
                canDelete = false;
            }
        } else if (entity_type === 'Project') {
            const jobs = await base44.asServiceRole.entities.Job.filter({ 
                project_id: entity_id,
                deleted_at: { $exists: false },
                status: { $in: ['Scheduled', 'Open', 'In Progress'] }
            });
            
            if (jobs.length > 0) {
                dependencies.push(`${jobs.length} active job(s)`);
                canDelete = false;
            }
        } else if (entity_type === 'Job') {
            const checkIns = await base44.asServiceRole.entities.CheckInOut.filter({
                job_id: entity_id
            });
            const unclosedCheckIns = checkIns.filter(c => !c.check_out_time);
            
            if (unclosedCheckIns.length > 0) {
                dependencies.push(`${unclosedCheckIns.length} active check-in(s)`);
                canDelete = false;
            }
        } else if (entity_type === 'Organisation') {
            const customers = await base44.asServiceRole.entities.Customer.filter({ 
                organisation_id: entity_id,
                deleted_at: { $exists: false }
            });
            
            if (customers.length > 0) {
                dependencies.push(`${customers.length} customer(s)`);
                canDelete = false;
            }
        } else if (entity_type === 'PriceListItem') {
            const inventoryQty = await base44.asServiceRole.entities.InventoryQuantity.filter({
                price_list_item_id: entity_id
            });
            
            const totalQty = inventoryQty.reduce((sum, iq) => sum + (iq.quantity_on_hand || 0), 0);
            
            if (totalQty > 0) {
                dependencies.push(`${totalQty} unit(s) in inventory`);
                canDelete = false;
            }
        }

        if (!canDelete) {
            return Response.json({ 
                can_delete: false,
                error: `Cannot delete ${entity_type.toLowerCase()} with dependencies`,
                dependencies: dependencies
            }, { status: 400 });
        }

        // Perform soft delete
        await base44.asServiceRole.entities[entity_type].update(entity_id, {
            deleted_at: new Date().toISOString()
        });

        return Response.json({ 
            success: true,
            can_delete: true,
            message: `${entity_type} deleted successfully`
        });

    } catch (error) {
        console.error("Safe delete error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});