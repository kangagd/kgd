/**
 * findThreadsByAddress - Find threads by sender address (flexible matching)
 * Diagnostic function to check what from_address values exist
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const bodyText = await req.text();
    const { email_search } = JSON.parse(bodyText || '{}');

    if (!email_search) {
      return Response.json({ error: 'Missing email_search' }, { status: 400 });
    }

    console.log(`[findThreadsByAddress] Searching for threads containing ${email_search}`);

    // Get all threads and filter in memory since we need flexible matching
    const allThreads = await base44.asServiceRole.entities.EmailThread.list(null, 1000);
    
    const matching = allThreads.filter(t => 
      t.from_address && t.from_address.toLowerCase().includes(email_search.toLowerCase())
    );

    console.log(`[findThreadsByAddress] Found ${matching.length} matching threads`);

    return Response.json({
      success: true,
      email_search,
      threads_found: matching.length,
      threads: matching.map(t => ({
        id: t.id,
        subject: t.subject,
        from_address: t.from_address,
        gmail_thread_id: t.gmail_thread_id,
        project_id: t.project_id,
        created_date: t.created_date
      }))
    });
  } catch (error) {
    console.error(`[findThreadsByAddress] Error:`, error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});