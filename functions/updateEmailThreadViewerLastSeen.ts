import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { thread_id } = await req.json();
        
        if (!thread_id) {
            return Response.json({ error: 'thread_id required' }, { status: 400 });
        }

        // Upsert viewer record
        const existing = await base44.asServiceRole.entities.EmailThreadViewer.filter({
            thread_id,
            user_email: user.email
        });

        if (existing.length > 0) {
            await base44.asServiceRole.entities.EmailThreadViewer.update(existing[0].id, {
                last_seen: new Date().toISOString()
            });
        } else {
            await base44.asServiceRole.entities.EmailThreadViewer.create({
                thread_id,
                user_email: user.email,
                user_name: user.display_name || user.full_name,
                last_seen: new Date().toISOString()
            });
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});