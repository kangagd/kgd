import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit = 100, cursor } = await req.json();

    let query = {};
    let options = { limit };

    // If cursor provided, get threads older than cursor timestamp
    if (cursor) {
      const cursorTime = new Date(cursor).getTime();
      // Fetch extra to ensure we get threads before cursor
      options.limit = limit + 10;
      
      const allThreads = await base44.asServiceRole.entities.EmailThread.list('-last_message_date', limit + 10);
      
      // Filter to threads with last_message_date < cursor
      const filtered = allThreads.filter(t => 
        !t.is_deleted && 
        new Date(t.last_message_date).getTime() < cursorTime
      );

      const result = filtered.slice(0, limit).map(t => ({
        ...t,
        viewers: []
      }));

      const nextCursor = result.length === limit ? result[result.length - 1].last_message_date : null;

      return Response.json({
        threads: result,
        cursor: nextCursor,
        hasMore: result.length === limit
      });
    }

    // First page: fetch latest threads
    const threads = await base44.asServiceRole.entities.EmailThread.list('-last_message_date', limit);
    const result = threads
      .filter(t => !t.is_deleted)
      .map(t => ({
        ...t,
        viewers: []
      }));

    const nextCursor = result.length === limit ? result[result.length - 1].last_message_date : null;

    return Response.json({
      threads: result,
      cursor: nextCursor,
      hasMore: result.length === limit
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});