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
            technician, 
            date_from, 
            date_to,
            view_mode = 'list' 
        } = await req.json().catch(() => ({}));

        const query = {
            deleted_at: null,
            status: { $ne: "Cancelled" }
        };

        // Status Filter
        if (status && status !== 'all') {
             if (status === 'Logistics') {
                 query.$or = [
                     { job_category: 'Logistics' },
                     { job_type_name: { $regex: 'Logistics', $options: 'i' } }
                 ];
             } else {
                 query.status = status;
             }
        }

        // Technician Filter
        if (technician && technician !== 'all') {
            query.assigned_to = technician;
        }

        // Date Range Filter
        if (date_from || date_to) {
            query.scheduled_date = {};
            if (date_from) query.scheduled_date.$gte = date_from;
            if (date_to) query.scheduled_date.$lte = date_to;
        }

        // Search Filter
        if (search) {
            const searchConditions = [
                { customer_name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
                { project_name: { $regex: search, $options: 'i' } }
            ];
            
            // If search looks like a number, try exact job_number match
            if (!isNaN(search)) {
                searchConditions.push({ job_number: Number(search) });
            }

            if (query.$or) {
                // If we already have an $or (from Logistics), we need to combine with $and
                query.$and = [
                    { $or: query.$or },
                    { $or: searchConditions }
                ];
                delete query.$or;
            } else {
                query.$or = searchConditions;
            }
        }

        // Pagination
        // For calendar view, we probably want ALL jobs in the range, so we might increase limit or ignore pagination
        const finalLimit = view_mode === 'calendar' ? 1000 : parseInt(limit);
        const skip = (parseInt(page) - 1) * finalLimit;

        // Sort
        // Default sort
        const sort = '-scheduled_date';

        const jobs = await base44.asServiceRole.entities.Job.filter(query, sort, finalLimit, skip);
        
        // Get total count for pagination if in list mode (optional, might be slow, Base44 doesn't expose count() easily on filtered queries without fetching? 
        // Actually we can't easily get count without fetching all or separate count query if supported.
        // For now, we just return data. Frontend can handle "Load More" or "Next Page" based on if we got full limit.
        
        return Response.json({
            data: jobs,
            page: parseInt(page),
            limit: finalLimit,
            hasMore: jobs.length === finalLimit
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});