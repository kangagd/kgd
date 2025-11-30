import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, data } = await req.json();
        let customer;

        if (action === 'create') {
            customer = await base44.asServiceRole.entities.Customer.create(data);

            // Log creation
            await base44.asServiceRole.entities.ActivityLog.create({
                entity_type: 'Customer',
                entity_id: customer.id,
                action: 'create',
                after_data: customer,
                user_email: user.email,
                user_name: user.full_name,
                details: `Created Customer: ${customer.name}`
            });

            // Check duplicates
            try {
                await base44.asServiceRole.functions.invoke('checkDuplicates', {
                    entity_type: 'Customer',
                    record: customer,
                    exclude_id: customer.id,
                    auto_update: true
                });
            } catch (e) {
                console.error("Duplicate check failed", e);
            }

        } else if (action === 'update') {
            const previousCustomer = await base44.asServiceRole.entities.Customer.get(id);
            customer = await base44.asServiceRole.entities.Customer.update(id, data);

            // Log update
            await base44.asServiceRole.entities.ActivityLog.create({
                entity_type: 'Customer',
                entity_id: id,
                action: 'update',
                before_data: previousCustomer,
                after_data: customer,
                user_email: user.email,
                user_name: user.full_name,
                details: `Updated Customer: ${customer.name}`
            });

             // Check duplicates
             try {
                await base44.asServiceRole.functions.invoke('checkDuplicates', {
                    entity_type: 'Customer',
                    record: { ...data, id },
                    exclude_id: id,
                    auto_update: true
                });
            } catch (e) {
                console.error("Duplicate check failed", e);
            }

        } else if (action === 'delete') {
            const beforeDelete = await base44.asServiceRole.entities.Customer.get(id);
            
            if (data && data.deleted_at) {
                customer = await base44.asServiceRole.entities.Customer.update(id, { deleted_at: data.deleted_at });
            } else {
                // Default soft delete if not specified or if hard delete requested (rare)
                // Assuming soft delete for consistency with other entities
                 customer = await base44.asServiceRole.entities.Customer.update(id, { deleted_at: new Date().toISOString() });
            }

            // Log delete
            await base44.asServiceRole.entities.ActivityLog.create({
                entity_type: 'Customer',
                entity_id: id,
                action: 'delete',
                before_data: beforeDelete,
                user_email: user.email,
                user_name: user.full_name,
                details: `Deleted Customer: ${beforeDelete.name}`
            });
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        return Response.json({ success: true, customer });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});