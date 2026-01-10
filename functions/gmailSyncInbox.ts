/**
 * gmailSyncInbox - Sync Gmail inbox threads into Base44
 * 
 * Pulls threads from the shared Gmail inbox (admin@kangaroogd.com.au)
 * and upserts EmailThread records. Does NOT pull full message bodies here.
 * 
 * Called periodically (scheduled task) or on-demand from frontend.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClientV2.js';

Deno.serve(async (req) => {
  let stage = 'init';
  try {
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and manager can trigger sync
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json({ error: 'Forbidden: Only admin/manager can sync inbox' }, { status: 403 });
    }

    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};
    const { q = 'in:inbox', maxResults = 50, pageToken = null } = requestBody;

    stage = 'gmail_list_threads';
    console.log('[gmailSyncInbox] Fetching threads with query:', q);

    const queryParams = {
      q,
      maxResults: Math.min(maxResults, 100), // Cap at 100
      labelIds: 'INBOX' // Always sync inbox
    };
    if (pageToken) {
      queryParams.pageToken = pageToken;
    }

    const listResult = await gmailFetch('/gmail/v1/users/me/threads', 'GET', null, queryParams);
    const threads = listResult.threads || [];
    
    console.log(`[gmailSyncInbox] Found ${threads.length} threads`);

    stage = 'upsert_threads';
    const upsertedThreads = [];

    for (const gmailThread of threads) {
      try {
        // Fetch minimal thread metadata (not full messages)
        const threadDetail = await gmailFetch(
          `/gmail/v1/users/me/threads/${gmailThread.id}`,
          'GET',
          null,
          { format: 'metadata' }
        );

        if (!threadDetail.messages || threadDetail.messages.length === 0) {
          console.log(`[gmailSyncInbox] Thread ${gmailThread.id} has no messages, skipping`);
          continue;
        }

        // Use first and last message for thread metadata
        const firstMsg = threadDetail.messages[0];
        const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];

        // Extract headers from last message
        const lastHeaders = {};
        if (lastMsg.payload?.headers) {
          lastMsg.payload.headers.forEach(h => {
            lastHeaders[h.name.toLowerCase()] = h.value;
          });
        }

        const subject = lastHeaders['subject'] || '(no subject)';
        const fromAddress = lastHeaders['from'] || '';
        const toAddresses = lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [];

        // Create/update snippet
        let snippet = threadDetail.snippet || '';
        if (snippet.length > 200) {
          snippet = snippet.substring(0, 200) + '...';
        }

        // Get last message date
        const lastMsgDate = lastMsg.internalDate ? new Date(parseInt(lastMsg.internalDate)).toISOString() : new Date().toISOString();

        // Check if thread already exists
        const existing = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: gmailThread.id
        });

        const threadData = {
          subject,
          gmail_thread_id: gmailThread.id,
          from_address: fromAddress,
          to_addresses: toAddresses,
          last_message_date: lastMsgDate,
          last_message_snippet: snippet,
          message_count: threadDetail.messages.length,
          is_read: !threadDetail.messages.some(m => m.labels?.includes('UNREAD'))
        };

        if (existing.length > 0) {
          // Update existing thread
          await base44.asServiceRole.entities.EmailThread.update(existing[0].id, threadData);
          upsertedThreads.push({
            id: existing[0].id,
            gmail_thread_id: gmailThread.id,
            action: 'updated'
          });
          console.log(`[gmailSyncInbox] Updated thread ${gmailThread.id}`);
        } else {
          // Create new thread
          const newThread = await base44.asServiceRole.entities.EmailThread.create(threadData);
          upsertedThreads.push({
            id: newThread.id,
            gmail_thread_id: gmailThread.id,
            action: 'created'
          });
          console.log(`[gmailSyncInbox] Created thread ${gmailThread.id}`);
        }
      } catch (err) {
        console.error(`[gmailSyncInbox] Error processing thread ${gmailThread.id}:`, err);
      }
    }

    return Response.json({
      success: true,
      synced: upsertedThreads.length,
      threads: upsertedThreads,
      nextPageToken: listResult.nextPageToken || null
    });
  } catch (error) {
    console.error(`[gmailSyncInbox] Error at stage '${stage}':`, error);
    return Response.json(
      { error: error.message, stage },
      { status: 500 }
    );
  }
});