
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// This line re-exports everything from the file updateProjectActivity.ts.
// The updateProjectActivity function is now expected to be defined in that separate file,
// and is no longer directly defined within this file.
export * from "./updateProjectActivity.ts";

/**
 * Updates the last_activity_at timestamp for a project
 * Does NOT modify updated_at or other fields
 * Safe to call multiple times - only updates the activity timestamp
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { project_id, activity_type } = await req.json();

        if (!project_id) {
            return Response.json({ error: 'project_id is required' }, { status: 400 });
        }

        // Update activity fields using service role to bypass RLS
        const timestamp = new Date().toISOString();
        const updates = {
            last_activity_at: timestamp
        };
        
        if (activity_type) {
            updates.last_activity_type = activity_type;
        }
        
        await base44.asServiceRole.entities.Project.update(project_id, updates);

        console.log(`Project freshness updated: ${project_id} → ${timestamp} [${activity_type || 'No type specified'}]`);

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});
