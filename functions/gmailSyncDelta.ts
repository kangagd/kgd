/**
 * gmailSyncDelta - Incremental sync using Gmail History API
 * 
 * Primary path: uses historyId cursor to fetch only changed messages
 * Fallback: controlled backfill when history is stale/missing
 * 
 * Returns structured counts and new state for orchestrator
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEBUG = false;

// ============================================================================
// Gmail Fetch Helpers (reuse from gmailSyncThreadMessages)
// ============================================================================

function base64urlEncode(data) {
  const base64 = btoa(data);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToArrayBuffer(pem) {
  const cleanPem = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createJwt(serviceAccount, impersonateEmail) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/gmail.modify',
    sub: impersonateEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  const privateKeyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureBinary = String.fromCharCode(...signatureArray);
  const signatureEncoded = base64urlEncode(signatureBinary);

  return `${signatureInput}.${signatureEncoded}`;
}

async function getAccessToken() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

  if (!serviceAccountJson || !impersonateEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_IMPERSONATE_USER_EMAIL');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const jwt = await createJwt(serviceAccount, impersonateEmail);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString()
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function gmailFetch(endpoint, method = 'GET', queryParams = null) {
  const accessToken = await getAccessToken();
  
  let url = `https://www.googleapis.com${endpoint}`;
  if (queryParams) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// ============================================================================
// Delta Sync Core
// ============================================================================

/**
 * Fetch current mailbox historyId
 */
async function getCurrentHistoryId() {
  const profile = await gmailFetch('/gmail/v1/users/me/profile');
  return profile.historyId;
}

/**
 * Fetch message IDs that changed since startHistoryId
 * Returns: { messageIds: Set, newHistoryId: string, pageCount: number }
 */
async function fetchHistoryDelta(startHistoryId, maxPages = 10) {
  const messageIds = new Set();
  let pageCount = 0;
  let pageToken = null;
  let historyId = startHistoryId;

  for (let page = 0; page < maxPages; page++) {
    const params = {
      startHistoryId: startHistoryId,
      maxResults: 100
    };
    if (pageToken) params.pageToken = pageToken;

    const result = await gmailFetch('/gmail/v1/users/me/history', 'GET', params);
    
    if (!result.history) break;

    for (const historyItem of result.history) {
      historyId = historyItem.id;

      // Collect from messagesAdded
      if (historyItem.messagesAdded) {
        for (const msg of historyItem.messagesAdded) {
          messageIds.add(msg.message.id);
        }
      }

      // Collect from labelsAdded/labelsRemoved (for messages moving in/out of INBOX/SENT)
      if (historyItem.labelsAdded) {
        for (const item of historyItem.labelsAdded) {
          if (['INBOX', 'SENT'].includes(item.labelIds?.[0])) {
            messageIds.add(item.message.id);
          }
        }
      }
      if (historyItem.labelsRemoved) {
        for (const item of historyItem.labelsRemoved) {
          if (['INBOX', 'SENT'].includes(item.labelIds?.[0])) {
            messageIds.add(item.message.id);
          }
        }
      }
    }

    pageCount++;
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  return { messageIds, newHistoryId: historyId, pageCount };
}

/**
 * Process Gmail message IDs - fetches and syncs to EmailMessage
 * Returns: { messages_fetched, messages_created, messages_upgraded, messages_skipped_existing, messages_failed, deleted_count }
 */
async function processMessageIds({ messageIds, base44, runId }) {
  const counts = {
    messages_fetched: 0,
    messages_created: 0,
    messages_upgraded: 0,
    messages_skipped_existing: 0,
    messages_failed: 0,
    deleted_count: 0
  };

  // Deduplicate and cap
  const uniqueIds = [...new Set(messageIds)];
  const MAX_MESSAGES_PER_RUN = 500;
  const idsToProcess = uniqueIds.slice(0, MAX_MESSAGES_PER_RUN);

  if (DEBUG && uniqueIds.length > MAX_MESSAGES_PER_RUN) {
    console.log(`[gmailSyncDelta] Capped ${uniqueIds.length} messages to ${MAX_MESSAGES_PER_RUN}`);
  }

  // Group messages by thread to invoke gmailSyncThreadMessages
  const threadMap = new Map();

  for (const msgId of idsToProcess) {
    try {
      // Fetch message to get thread ID
      const gmailMsg = await gmailFetch(`/gmail/v1/users/me/messages/${msgId}`, 'GET', { format: 'minimal' });
      
      if (!threadMap.has(gmailMsg.threadId)) {
        threadMap.set(gmailMsg.threadId, []);
      }
      threadMap.get(gmailMsg.threadId).push(msgId);
      counts.messages_fetched++;
    } catch (err) {
      if (err.message.includes('404')) {
        // Message deleted
        try {
          const existing = await base44.asServiceRole.entities.EmailMessage.filter({ gmail_message_id: msgId });
          if (existing.length > 0) {
            await base44.asServiceRole.entities.EmailMessage.update(existing[0].id, { is_deleted: true });
            counts.deleted_count++;
          }
        } catch (delErr) {
          console.error(`[gmailSyncDelta] Failed to mark deleted: ${msgId}`, delErr.message);
        }
      } else {
        counts.messages_failed++;
        console.error(`[gmailSyncDelta] Failed to fetch message ${msgId}:`, err.message);
      }
    }
  }

  // Process each thread with rate limiting
  let processedCount = 0;
  for (const [threadId, msgIds] of threadMap.entries()) {
    try {
      const response = await base44.functions.invoke('gmailSyncThreadMessages', { 
        gmail_thread_id: threadId 
      });

      const result = response.data || {};
      counts.messages_created += result.okCount || 0;
      counts.messages_upgraded += result.partialCount || 0;
      counts.messages_failed += result.failedCount || 0;

      processedCount++;

      // Rate limiting: wait 100ms every 10 threads to avoid 429s
      if (processedCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error(`[gmailSyncDelta] Failed to sync thread ${threadId}:`, err.message);
      counts.messages_failed += msgIds.length;

      // If we hit rate limit, wait longer before continuing
      if (err.message?.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return counts;
}

// ============================================================================
// Backfill (controlled, interruptible)
// ============================================================================

async function fetchBackfillMessages(cursorDate, windowDays, base44, runId) {
  const endDate = new Date(cursorDate);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - windowDays);

  const afterDate = startDate.toISOString().split('T')[0].replace(/-/g, '/');
  const beforeDate = endDate.toISOString().split('T')[0].replace(/-/g, '/');

  // Fetch ALL messages in date range, not just INBOX/SENT
  // This includes automated emails, notifications, etc that might not have standard labels
  const q = `after:${afterDate} before:${beforeDate}`;

  const messages = [];
  let pageToken = null;
  let pageCount = 0;

  for (let page = 0; page < 5; page++) {
    const params = { q, maxResults: 100 };
    if (pageToken) params.pageToken = pageToken;

    const result = await gmailFetch('/gmail/v1/users/me/messages', 'GET', params);

    if (result.messages) {
      messages.push(...result.messages.map(m => m.id));
    }

    pageCount++;
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  return { messageIds: new Set(messages), pageCount };
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const { scope_key, max_history_pages, max_messages_fetched } = bodyText ? JSON.parse(bodyText) : {};

    const runId = crypto.randomUUID();
    const maxHistoryPages = max_history_pages || 10;
    const maxMessagesFetched = max_messages_fetched || 500;

    if (!scope_key) {
      return Response.json({ error: 'Missing scope_key' }, { status: 400 });
    }

    // Load or create sync state
    const states = await base44.asServiceRole.entities.EmailSyncState.filter({ scope_key });
    let syncState = states[0];

    if (!syncState) {
      syncState = await base44.asServiceRole.entities.EmailSyncState.create({
        scope_key,
        consecutive_failures: 0,
        backfill_mode: 'off'
      });
    }

    let mode = 'delta';
    const counts = {
      history_pages: 0,
      message_ids_changed: 0,
      messages_fetched: 0,
      messages_created: 0,
      messages_upgraded: 0,
      messages_failed: 0
    };

    // If no history ID exists, bootstrap with current history ID and enter backfill mode
    if (!syncState.last_history_id && syncState.backfill_mode === 'off') {
      console.log('[gmailSyncDelta] No history ID - bootstrapping and entering backfill mode');
      
      // Get current history ID to establish baseline
      const currentHistoryId = await getCurrentHistoryId();
      
      // Update state to start backfill from today going backwards
      syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
        last_history_id: currentHistoryId,
        backfill_mode: 'catchup',
        backfill_cursor: new Date().toISOString(),
        backfill_window_days: 7
      });
      
      mode = 'backfill';
    }

    // Attempt delta if history ID exists
    if (syncState.last_history_id && syncState.backfill_mode === 'off') {
      try {
        console.log(`[gmailSyncDelta] Delta mode - startHistoryId: ${syncState.last_history_id}`);
        const { messageIds, newHistoryId, pageCount } = await fetchHistoryDelta(
          syncState.last_history_id,
          maxHistoryPages
        );

        counts.history_pages = pageCount;
        counts.message_ids_changed = messageIds.size;
        
        console.log(`[gmailSyncDelta] Delta found ${messageIds.size} changed messages`);
        
        // Process messages
        if (messageIds.size > 0) {
          const processCounts = await processMessageIds({ 
            messageIds: Array.from(messageIds), 
            base44, 
            runId 
          });
          Object.assign(counts, processCounts);
          
          console.log(`[gmailSyncDelta] Processed: ${processCounts.messages_fetched} fetched, ${processCounts.messages_created} created`);
        }
        
        // INVARIANT: If we found changed messages but didn't fetch any, something is broken
        if (messageIds.size > 0 && counts.messages_fetched === 0) {
          console.error('[gmailSyncDelta] INVARIANT VIOLATION: messageIds collected but not processed');
          return Response.json({
            success: false,
            run_id: runId,
            reason: 'delta-collected-but-not-processed',
            message_ids_changed: messageIds.size,
            counts
          }, { status: 500 });
        }
        
        // Update state
        syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
          last_history_id: newHistoryId,
          last_delta_sync_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          consecutive_failures: 0
        });

        console.log(`[gmailSyncDelta] Delta complete: ${counts.messages_fetched} messages fetched`);

        return Response.json({
          success: true,
          run_id: runId,
          mode,
          counts,
          new_last_history_id: newHistoryId
        });
      } catch (err) {
        if (err.message.includes('404') || err.message.includes('Invalid')) {
          // History expired; enter backfill mode
          mode = 'backfill';
          console.log(`[gmailSyncDelta] History expired, entering backfill`);
        } else {
          throw err;
        }
      }
    }

    // Backfill mode
    if (mode === 'backfill' || syncState.backfill_mode !== 'off') {
      mode = 'backfill';
      const now = new Date();
      const cursorDate = syncState.backfill_cursor ? new Date(syncState.backfill_cursor) : now;
      const windowDays = syncState.backfill_window_days || 7;

      console.log(`[gmailSyncDelta] Backfill mode - cursor: ${cursorDate.toISOString()}, window: ${windowDays} days`);

      const { messageIds, pageCount } = await fetchBackfillMessages(cursorDate, windowDays, base44, runId);

      counts.message_ids_changed = messageIds.size;
      
      console.log(`[gmailSyncDelta] Backfill found ${messageIds.size} messages`);
      
      // Process messages
      if (messageIds.size > 0) {
        const processCounts = await processMessageIds({ 
          messageIds: Array.from(messageIds), 
          base44, 
          runId 
        });
        Object.assign(counts, processCounts);
        
        console.log(`[gmailSyncDelta] Backfill processed: ${processCounts.messages_fetched} fetched, ${processCounts.messages_created} created`);
      }
      
      // INVARIANT: If we found messages but didn't process them, fail loudly
      if (messageIds.size > 0 && counts.messages_fetched === 0) {
        console.error('[gmailSyncDelta] INVARIANT VIOLATION: backfill collected but not processed');
        return Response.json({
          success: false,
          run_id: runId,
          reason: 'backfill-collected-but-not-processed',
          message_ids_changed: messageIds.size,
          counts
        }, { status: 500 });
      }
      
      const nextCursor = new Date(cursorDate);
      nextCursor.setDate(nextCursor.getDate() - windowDays);

      const nextBackfillMode = nextCursor < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? 'off' : 'catchup';

      // Update state
      syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
        backfill_cursor: nextCursor.toISOString(),
        backfill_mode: nextBackfillMode,
        last_full_sync_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0
      });

      // If backfill complete, establish fresh history ID
      if (nextBackfillMode === 'off') {
        const freshHistoryId = await getCurrentHistoryId();
        syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
          last_history_id: freshHistoryId
        });
        console.log(`[gmailSyncDelta] Backfill complete - set history ID: ${freshHistoryId}`);
      }

      console.log(`[gmailSyncDelta] Backfill: ${pageCount} pages, ${messageIds.size} messages, ${counts.messages_fetched} fetched, mode -> ${nextBackfillMode}`);

      return Response.json({
        success: true,
        run_id: runId,
        mode,
        counts,
        next_backfill_mode: nextBackfillMode
      });
    }

    return Response.json({
      success: true,
      run_id: runId,
      mode: 'idle',
      counts
    });
  } catch (error) {
    console.error(`[gmailSyncDelta] Error:`, error.message);
    return Response.json(
      { error: error.message, run_id: crypto.randomUUID() },
      { status: 500 }
    );
  }
});