import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';
import { PART_STATUS, PART_LOCATION } from './shared/constants.js';
import { determinePartStatus } from './shared/partHelpers.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { part_ids, from_location, to_location, project_id, note } = await req.json();

        // Validation
        if (!part_ids || !Array.isArray(part_ids) || part_ids.length === 0) {
            return Response.json({ 
                success: false, 
                error: 'part_ids array is required and must not be empty' 
            }, { status: 400 });
        }

        const validLocations = Object.values(PART_LOCATION);
        if (!from_location || !validLocations.includes(from_location)) {
            return Response.json({ 
                success: false, 
                error: `Invalid from_location. Must be one of: ${validLocations.join(', ')}` 
            }, { status: 400 });
        }

        if (!to_location || !validLocations.includes(to_location)) {
            return Response.json({ 
                success: false, 
                error: `Invalid to_location. Must be one of: ${validLocations.join(', ')}` 
            }, { status: 400 });
        }

        // Fetch all parts
        const parts = await Promise.all(
            part_ids.map(id => 
                base44.asServiceRole.entities.Part.get(id).catch(() => null)
            )
        );

        const validParts = parts.filter(p => p !== null);
        if (validParts.length === 0) {
            return Response.json({ 
                success: false, 
                error: 'No valid parts found' 
            }, { status: 404 });
        }

        // Determine new status based on destination
        const newStatus = determinePartStatus(to_location);

        const updatedParts = [];
        const timestamp = new Date().toISOString();

        // Process each part
        for (const part of validParts) {
            // Create movement log
            await base44.asServiceRole.entities.StockMovement.create({
                part_id: part.id,
                project_id: part.project_id || project_id || null,
                from_location,
                to_location,
                moved_by: user.email,
                moved_by_name: user.full_name || user.email,
                moved_at: timestamp,
                notes: note || null,
            });

            // Update part status if applicable
            const updateData = { location: to_location };
            if (newStatus) {
                updateData.status = newStatus;
            }

            const updatedPart = await base44.asServiceRole.entities.Part.update(
                part.id,
                updateData
            );
            updatedParts.push(updatedPart);
        }

        return Response.json({
            success: true,
            parts: updatedParts
        });

    } catch (error) {
        console.error('Error recording stock movement:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});