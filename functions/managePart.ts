import { createClientFromRequest } from './shared/sdk.js';
import { updateProjectActivity } from './updateProjectActivity.js';
import { LOGISTICS_PURPOSE } from './shared/constants.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, data } = await req.json();

        let part;
        let previousPart = null;

        if (action === 'create') {
            part = await base44.asServiceRole.entities.Part.create(data);
            
            // Update project activity when part is created
            if (part.project_id) {
                await updateProjectActivity(base44, part.project_id, 'Part Created');
            }

            // DEPRECATED: Legacy logistics automation removed
            // Use createLogisticsJobForPO for PO-based logistics
            // Use recordStockMovement for manual part movements

        } else if (action === 'update') {
            // Fetch previous state for logic comparison
            previousPart = await base44.asServiceRole.entities.Part.get(id);
            part = await base44.asServiceRole.entities.Part.update(id, data);
            
            // Update project activity when part is updated
            if (part.project_id) {
                await updateProjectActivity(base44, part.project_id, 'Part Updated');
            }
        } else if (action === 'delete') {
            await base44.asServiceRole.entities.Part.delete(id);
            return Response.json({ success: true });
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        // LEGACY LOGISTICS AUTOMATION DISABLED (prevents duplicate job creation)
        // Use createLogisticsJobForPO for all PO-based logistics job creation
        // Use recordStockMovement for manual part movements

        return Response.json({ success: true, part });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});