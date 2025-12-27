import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Service role is needed to check all parts
        const parts = await base44.asServiceRole.entities.Part.filter({
            status: { $in: ['Ordered', 'Back-ordered'] }
        });

        const today = new Date().toISOString().split('T')[0];
        const reminders = [];

        for (const part of parts) {
            if (part.eta === today) {
                // Create notification
                const message = `Check delivery status for Part ${part.category} on Project ${part.project_id} (ETA today).`;
                
                // Find admins to notify
                const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
                
                for (const admin of admins) {
                     await base44.asServiceRole.entities.Notification.create({
                        user_email: admin.email,
                        title: "Part ETA Reminder",
                        message: message,
                        is_read: false,
                        created_at: new Date().toISOString(),
                        link: `/projects?projectId=${part.project_id}`
                    });
                }
                reminders.push({ partId: part.id, message });
            }
        }

        return Response.json({ success: true, remindersSent: reminders.length, reminders });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});