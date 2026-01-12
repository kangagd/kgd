/**
 * adminFindEmailThreads - Find EmailThread records with flexible filtering
 * Purpose: Discover threads even when UI state is inconsistent
 * 
 * Inputs (all optional):
 *   - gmail_thread_id: exact Gmail thread ID
 *   - subject_contains: case-insensitive substring match
 *   - from_contains: case-insensitive sender match
 *   - to_contains: case-insensitive recipient match
 *   - snippet_contains: case-insensitive content match
 *   - project_id: linked project ID
 * 
 * Returns: array of matching threads with metadata
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only access
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const {
      gmail_thread_id = null,
      subject_contains = null,
      from_contains = null,
      to_contains = null,
      snippet_contains = null,
      project_id = null
    } = await req.json();

    // Validate at least one filter provided
    if (!gmail_thread_id && !subject_contains && !from_contains && !to_contains && !snippet_contains && !project_id) {
      return Response.json({ error: 'Provide at least one search filter' }, { status: 400 });
    }

    let threads = [];

    // Strategy 1: Direct gmail_thread_id lookup (fastest)
    if (gmail_thread_id) {
      const result = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id: gmail_thread_id
      });
      threads = result;
      console.log(`[adminFindEmailThreads] Found ${threads.length} thread(s) by gmail_thread_id: ${gmail_thread_id}`);
    }
    // Strategy 2: Direct project_id lookup
    else if (project_id) {
      const result = await base44.asServiceRole.entities.EmailThread.filter({
        project_id: project_id
      });
      threads = result;
      console.log(`[adminFindEmailThreads] Found ${threads.length} thread(s) by project_id: ${project_id}`);
    }
    // Strategy 3: Text search (fetch and filter in memory)
    else {
      // Fetch recent threads (limit 200 by creation date DESC)
      const allThreads = await base44.asServiceRole.entities.EmailThread.list('-updated_date', 200);
      
      threads = allThreads.filter(thread => {
        const subjectLower = (thread.subject || '').toLowerCase();
        const fromLower = (thread.from_address || '').toLowerCase();
        const toLower = (thread.to_addresses?.join(' ') || '').toLowerCase();
        const snippetLower = (thread.last_message_snippet || '').toLowerCase();

        if (subject_contains && !subjectLower.includes(subject_contains.toLowerCase())) return false;
        if (from_contains && !fromLower.includes(from_contains.toLowerCase())) return false;
        if (to_contains && !toLower.includes(to_contains.toLowerCase())) return false;
        if (snippet_contains && !snippetLower.includes(snippet_contains.toLowerCase())) return false;

        return true;
      });

      console.log(`[adminFindEmailThreads] Found ${threads.length} thread(s) matching text filters`);
    }

    // Enrich results with key metadata
    const results = threads.map(thread => ({
      id: thread.id,
      gmail_thread_id: thread.gmail_thread_id,
      subject: thread.subject,
      project_id: thread.project_id,
      linked_job_id: thread.linked_job_id || null,
      last_message_date: thread.last_message_date,
      last_message_snippet: thread.last_message_snippet,
      message_count: thread.message_count,
      status: thread.status,
      deleted_at: thread.deleted_at || null,
      created_date: thread.created_date
    }));

    return Response.json({
      success: true,
      count: results.length,
      threads: results
    });

  } catch (error) {
    console.error('[adminFindEmailThreads] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});