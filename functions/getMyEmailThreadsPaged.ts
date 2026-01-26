import { createClientFromRequest } from './shared/sdk.ts';

/**
 * Paginated email threads: returns threads before a given date
 * For UI pagination, pass last thread's last_message_date as beforeDate
 * Mirrors getMyEmailThreads.ts access logic (admin/manager only)
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Allow admins and managers to fetch all email threads
        const role = (user.extended_role || user.role || "").toLowerCase();
        const isAdmin = user.role === 'admin' || role === 'admin';
        const isManager = role === 'manager';

        if (!(isAdmin || isManager)) {
            return Response.json({ error: 'Forbidden: Only admins and managers can view inbox' }, { status: 403 });
        }

        const { limit = 100, beforeDate = null } = await req.json();

        if (!Number.isFinite(limit) || limit <= 0) {
            return Response.json({ error: 'Invalid limit' }, { status: 400 });
        }

        // Use service role to bypass EmailThread entity RLS
        let threads;
        if (beforeDate) {
            threads = await base44.asServiceRole.entities.EmailThread.filter(
                { last_message_date: { $lt: beforeDate } },
                '-last_message_date',
                limit + 1
            );
        } else {
            threads = await base44.asServiceRole.entities.EmailThread.list(
                '-last_message_date',
                limit + 1
            );
        }

        // Check if there are more
        const hasMore = threads.length > limit;
        const result = threads.slice(0, limit);

        return Response.json({
            threads: result,
            hasMore,
            nextBeforeDate: result.length > 0 ? result[result.length - 1].last_message_date : null
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