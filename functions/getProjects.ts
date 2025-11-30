import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { 
            page = 1, 
            limit = 50, 
            search, 
            status, 
            date_from, 
            date_to 
        } = await req.json().catch(() => ({}));

        const query = {
            deleted_at: null,
            status: { $ne: "Lost" }
        };

        // Status Filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Date Range Filter
        if (date_from || date_to) {
            query.created_date = {};
            if (date_from) query.created_date.$gte = date_from;
            if (date_to) query.created_date.$lte = date_to;
        }

        // Search Filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { customer_name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = '-created_date';

        const projects = await base44.asServiceRole.entities.Project.filter(query, sort, parseInt(limit), skip);

        return Response.json({
            data: projects,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: projects.length === parseInt(limit)
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});