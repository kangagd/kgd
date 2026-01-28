import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { purchase_order_id } = await req.json();
        
        if (!purchase_order_id) {
            return Response.json({ error: 'purchase_order_id required' }, { status: 400 });
        }

        const jobs = await base44.asServiceRole.entities.Job.filter({
            purchase_order_id,
            is_logistics_job: true
        });

        return Response.json({ success: true, jobs });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});