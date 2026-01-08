import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Validates project number uniqueness before assignment
 * CRITICAL: Prevents duplicate project numbers
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { project_number, exclude_project_id } = await req.json();

        if (!project_number) {
            return Response.json({ error: 'Project number is required' }, { status: 400 });
        }

        // Check for duplicates
        const existingProjects = await base44.asServiceRole.entities.Project.filter({
            project_number: project_number,
            deleted_at: { $exists: false }
        });

        // Exclude current project if updating
        const duplicates = exclude_project_id 
            ? existingProjects.filter(p => p.id !== exclude_project_id)
            : existingProjects;

        const is_duplicate = duplicates.length > 0;

        return Response.json({
            is_duplicate,
            duplicate_projects: duplicates.map(p => ({
                id: p.id,
                title: p.title,
                customer_name: p.customer_name,
                status: p.status
            }))
        });

    } catch (error) {
        console.error("Validate project number error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});