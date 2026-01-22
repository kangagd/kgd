import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const runs = await base44.asServiceRole.entities.BaselineSeedRun.list();
        return Response.json({ success: true, data: runs });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});