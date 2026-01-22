import { createClientFromRequest } from './shared/sdk.js';

/**
 * Paginated email threads: returns threads before a given date
 * For UI pagination, pass last thread's last_message_date as beforeDate
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { limit = 100, beforeDate = null } = await req.json();

        if (!Number.isFinite(limit) || limit <= 0) {
            return Response.json({ error: 'Invalid limit' }, { status: 400 });
        }

        // Fetch user's email threads
        let query = { created_by: user.email };
        
        // If beforeDate provided, filter to threads before that timestamp
        if (beforeDate) {
            query.last_message_date = { $lt: beforeDate };
        }

        const threads = await base44.entities.EmailThread.filter(
            query,
            '-last_message_date',
            limit + 1
        );

        // Check if there are more
        const hasMore = threads.length > limit;
        const result = threads.slice(0, limit);

        return Response.json({
            threads: result,
            hasMore,
            cursor: result.length > 0 ? result[result.length - 1].last_message_date : null
        });
    } catch (error) {
        console.error('[getMyEmailThreadsPaged] Error:', error);
        return Response.json({
            error: error.message,
            threads: [],
            hasMore: false
        }, { status: 500 });
    }
});