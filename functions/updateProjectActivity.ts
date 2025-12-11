import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Updates the last_activity_at timestamp for a project
 * Does NOT modify updated_at or other fields
 * Safe to call multiple times - only updates the activity timestamp
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { project_id } = await req.json();

        if (!project_id) {
            return Response.json({ error: 'project_id is required' }, { status: 400 });
        }

        // Update only last_activity_at field using service role to bypass RLS
        await base44.asServiceRole.entities.Project.update(project_id, {
            last_activity_at: new Date().toISOString()
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * Helper function to be imported in other backend functions
 * Can be called with base44 client instance and project_id
 */
export async function updateProjectActivity(base44, project_id) {
    if (!project_id) return;
    
    try {
        await base44.asServiceRole.entities.Project.update(project_id, {
            last_activity_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error updating project activity:', error);
        // Don't throw - this is a background update
    }
}