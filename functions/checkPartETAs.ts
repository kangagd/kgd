import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Service role is needed to check all parts
        const parts = await base44.asServiceRole.entities.Part.filter({
            status: { $in: ['Ordered', 'Back-ordered'] }
        });

        const today = new Date().toISOString().split('T')[0];
        let remindersSent = 0;

        // Get admins
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

        for (const part of parts) {
            if (part.eta === today) {
                const message = `Part ${part.category} for Project is expected today.`;
                
                for (const admin of admins) {
                     await base44.asServiceRole.functions.invoke('createNotification', {
                        userId: admin.id,
                        title: "Part ETA Today",
                        message: message,
                        entityType: "Part",
                        entityId: part.id,
                        priority: "normal"
                    });
                }
                remindersSent++;
            }
        }

        return Response.json({ success: true, remindersSent });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});