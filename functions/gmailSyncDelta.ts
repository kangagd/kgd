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

const WATCH_LABELS = ["INBOX", "SENT"];

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
 * Helper to check if labelIds array contains any of the wanted labels
 */
function hasAnyLabel(labelIds, wanted) {
  return Array.isArray(labelIds) && wanted.some(l => labelIds.includes(l));
}

/**
 * Safe max for historyId strings (treat as BigInt)
 */
function maxHistoryId(a, b) {
  try {
    return BigInt(a) > BigInt(b) ? a : b;
  } catch {
    return a || b;
  }
}

/**
 * Fetch message IDs for a specific label since startHistoryId
 */
async function fetchHistoryDeltaForLabel(startHistoryId, labelId, maxPages = 10) {
  const messageIds = new Set();
  const deletedIds = new Set();
  let pageCount = 0;
  let pageToken = null;
  let newHistoryId = startHistoryId;

  const breakdown = {
    from_messagesAdded: 0,
    from_labelsAdded: 0,
    from_labelsRemoved: 0,
    from_messagesDeleted: 0
  };

  for (let page = 0; page < maxPages; page++) {
    const params = {
      startHistoryId: startHistoryId,
      labelId: labelId,
      maxResults: 100
    };
    if (pageToken) params.pageToken = pageToken;

    const result = await gmailFetch('/gmail/v1/users/me/history', 'GET', params);
    
    // Update cursor from response historyId (NOT historyItem.id)
    if (result.historyId) {
      newHistoryId = result.historyId;
    }
    
    if (!result.history) break;

    for (const historyItem of result.history) {
      // Collect from messagesAdded
      if (historyItem.messagesAdded) {
        for (const msg of historyItem.messagesAdded) {
          messageIds.add(msg.message.id);
          breakdown.from_messagesAdded++;
        }
      }

      // Collect from labelsAdded
      if (historyItem.labelsAdded) {
        for (const item of historyItem.labelsAdded) {
          messageIds.add(item.message.id);
          breakdown.from_labelsAdded++;
        }
      }

      // Collect from labelsRemoved
      if (historyItem.labelsRemoved) {
        for (const item of historyItem.labelsRemoved) {
          messageIds.add(item.message.id);
          breakdown.from_labelsRemoved++;
        }
      }

      // Track deletions
      if (historyItem.messagesDeleted) {
        for (const msg of historyItem.messagesDeleted) {
          deletedIds.add(msg.message.id);
          breakdown.from_messagesDeleted++;
        }
      }
    }

    pageCount++;
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  return { messageIds, deletedIds, newHistoryId, pageCount, breakdown };
}

/**
 * Fetch combined history for INBOX + SENT labels
 */
async function fetchHistoryDelta(startHistoryId, maxPages = 10) {
  const WATCH_LABELS = ['INBOX', 'SENT'];
  const messageIds = new Set();
  const deletedIds = new Set();
  const debugBreakdown = {};

  let combinedNewHistoryId = startHistoryId;
  let totalPages = 0;

  for (const label of WATCH_LABELS) {
    try {
      const labelResult = await fetchHistoryDeltaForLabel(startHistoryId, label, maxPages);
      
      // Union message IDs
      labelResult.messageIds.forEach(id => messageIds.add(id));
      labelResult.deletedIds.forEach(id => deletedIds.add(id));
      
      // Track newest historyId
      combinedNewHistoryId = maxHistoryId(combinedNewHistoryId, labelResult.newHistoryId);
      
      totalPages += labelResult.pageCount;
      debugBreakdown[label.toLowerCase()] = labelResult.breakdown;
    } catch (err) {
      // If one label fails but the other succeeds, continue
      console.error(`[gmailSyncDelta] History for ${label} failed:`, err.message);
      debugBreakdown[label.toLowerCase()] = { error: err.message };
    }
  }

  return { 
    messageIds, 
    deletedIds,
    newHistoryId: combinedNewHistoryId, 
    pageCount: totalPages,
    debugBreakdown 
  };
}

/**
 * Mark deleted messages in database
 */
async function markDeleted(base44, deletedIds) {
  let count = 0;
  for (const msgId of deletedIds) {
    try {
      const existing = await base44.asServiceRole.entities.EmailMessage.filter({ gmail_message_id: msgId });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.EmailMessage.update(existing[0].id, { is_deleted: true });
        count++;
      }
    } catch (err) {
      // Ignore - record may not exist
    }
  }
  return count;
}

/**
 * List recent INBOX message IDs (bounded, for reconciliation)
 */
async function listRecentInboxMessageIds({ days = 7, maxResults = 200 }) {
  const q = `label:inbox newer_than:${days}d`;
  const ids = [];
  let pageToken = null;

  for (let page = 0; page < 3; page++) {
    const params = { q, maxResults: String(Math.min(100, maxResults - ids.length)) };
    if (pageToken) params.pageToken = pageToken;

    const result = await gmailFetch('/gmail/v1/users/me/messages', 'GET', params);
    if (result.messages?.length) {
      for (const m of result.messages) {
        if (m?.id) ids.push(m.id);
        if (ids.length >= maxResults) break;
      }
    }
    if (!result.nextPageToken || ids.length >= maxResults) break;
    pageToken = result.nextPageToken;
  }

  return ids;
}

/**
 * Filter message IDs not present in EmailMessage entity (BATCHED)
 */
async function filterMissingEmailMessageIds({ base44, messageIds, maxMissing = 50 }) {
  if (!messageIds?.length) return [];
  
  // Cap input to avoid huge queries
  const idsToCheck = messageIds.slice(0, 100);
  
  // Batch query: fetch all existing messages with these IDs
  const existing = await base44.asServiceRole.entities.EmailMessage.filter({
    gmail_message_id: { $in: idsToCheck }
  });
  
  const existingSet = new Set(existing.map(m => m.gmail_message_id));
  const missing = idsToCheck.filter(id => !existingSet.has(id));
  
  // Cap missing results
  return missing.slice(0, maxMissing);
}

/**
 * Process Gmail message IDs - fetches and syncs to EmailMessage
 * Returns counts + failed IDs that should stay in pending queue
 */
async function processMessageIds({ messageIds, base44, runId, maxMessagesFetched = 75, runStartedAt, maxRunMs }) {
  const counts = {
    messages_fetched: 0,
    messages_created: 0,
    messages_upgraded: 0,
    messages_skipped_existing: 0,
    messages_failed: 0,
    deleted_count: 0,
    threads_queued: 0,
    threads_capped: false,
    budget_exhausted: false
  };

  // Deduplicate and cap at drainLimit
  const uniqueIds = [...new Set(messageIds)];
  const drainLimit = Math.min(maxMessagesFetched || 75, 200);
  const idsToProcess = uniqueIds.slice(0, drainLimit);
  
  // Track which IDs failed (stay in queue)
  const failedIds = new Set();

  if (idsToProcess.length < uniqueIds.length) {
    console.log(`[gmailSyncDelta] Draining ${idsToProcess.length} of ${uniqueIds.length} pending IDs`);
  }

  // Group messages by thread to invoke gmailSyncThreadMessages
  const threadMap = new Map();
  const MAX_THREADS_PER_RUN = 10;

  for (const msgId of idsToProcess) {
    // Budget guard: stop if we're approaching timeout
    if (runStartedAt && maxRunMs && Date.now() - runStartedAt > maxRunMs) {
      counts.budget_exhausted = true;
      // Any unprocessed IDs stay in pending
      failedIds.add(msgId);
      console.log(`[gmailSyncDelta] Budget exhausted at message fetch, keeping ${failedIds.size} IDs in pending`);
      break;
    }

    try {
      // Fetch message to get thread ID
      const gmailMsg = await gmailFetch(`/gmail/v1/users/me/messages/${msgId}`, 'GET', { format: 'minimal' });
      
      // Cap threads: stop adding new threads after MAX_THREADS_PER_RUN
      if (!threadMap.has(gmailMsg.threadId)) {
        if (threadMap.size >= MAX_THREADS_PER_RUN) {
          counts.threads_capped = true;
          // Unprocessed IDs stay in queue
          failedIds.add(msgId);
          console.log(`[gmailSyncDelta] Thread cap reached (${MAX_THREADS_PER_RUN}), keeping ${failedIds.size} IDs in pending`);
          break;
        }
        threadMap.set(gmailMsg.threadId, []);
      }
      threadMap.get(gmailMsg.threadId).push(msgId);
      counts.messages_fetched++;
    } catch (err) {
      if (err.message.includes('404')) {
        // Message deleted - remove from pending
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
        // Keep failed fetch in pending for retry
        failedIds.add(msgId);
        console.error(`[gmailSyncDelta] Failed to fetch message ${msgId}:`, err.message);
      }
    }
  }

  counts.threads_queued = threadMap.size;

  // Process each thread with rate limiting
  let processedCount = 0;
  for (const [threadId, msgIds] of threadMap.entries()) {
    // Budget guard: stop if approaching timeout
    if (runStartedAt && maxRunMs && Date.now() - runStartedAt > maxRunMs) {
      counts.budget_exhausted = true;
      // Keep all unprocessed message IDs in queue
      msgIds.forEach(id => failedIds.add(id));
      console.log(`[gmailSyncDelta] Budget exhausted after ${processedCount} threads, keeping ${failedIds.size} IDs in pending`);
      break;
    }

    try {
      const response = await base44.asServiceRole.functions.invoke('gmailSyncThreadMessages', { 
        gmail_thread_id: threadId 
      });

      const result = response.data || {};
      const okCount = result.okCount || 0;
      const partialCount = result.partialCount || 0;
      const failedCount = result.failedCount || 0;
      
      counts.messages_created += okCount;
      counts.messages_upgraded += partialCount;
      counts.messages_failed += failedCount;

      // Only remove IDs if thread sync had any success
      if (okCount + partialCount > 0) {
        // Success: these IDs leave the queue
        msgIds.forEach(id => {
          // Don't add to failedIds - they're done
        });
      } else if (failedCount > 0) {
        // Hard failure: keep in queue for retry
        msgIds.forEach(id => failedIds.add(id));
      }

      processedCount++;

      // Rate limiting: checkpoint every 10 threads
      if (processedCount % 10 === 0) {
        console.log(`[gmailSyncDelta] Checkpoint: processed ${processedCount} threads`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`[gmailSyncDelta] Failed to sync thread ${threadId}:`, err.message);
      counts.messages_failed += msgIds.length;
      // Keep failed thread's IDs in pending
      msgIds.forEach(id => failedIds.add(id));

      // If we hit rate limit, wait longer before continuing
      if (err.message?.includes('429') || err.message?.includes('Rate limit')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  return { counts, failedIds };
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

  const q = `after:${afterDate} before:${beforeDate} (label:INBOX OR label:SENT)`;

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
  const runStartedAt = Date.now();
  const MAX_RUN_MS = 35000; // 35s budget (leaves headroom for orchestrator)

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const { scope_key, max_history_pages, max_messages_fetched, force_reconcile } = bodyText ? JSON.parse(bodyText) : {};

    const runId = crypto.randomUUID();
    const maxHistoryPages = max_history_pages || 10;
    const maxMessagesFetched = max_messages_fetched || 10;

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
        backfill_mode: 'off',
        pending_message_ids_json: '[]',
        backlog_size: 0
      });
    }

    let mode = 'delta';
    const counts = {
      history_pages: 0,
      message_ids_changed: 0,
      history_message_ids: 0,
      messages_fetched: 0,
      messages_created: 0,
      messages_upgraded: 0,
      messages_failed: 0,
      threads_queued: 0,
      threads_capped: false,
      budget_exhausted: false,
      inbox_reconciled: false
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
        
        // STEP 1: History delta collection (optimisation)
        const hist = await fetchHistoryDelta(
          syncState.last_history_id,
          maxHistoryPages
        );

        counts.history_pages = hist.pageCount;
        const historyMessageIds = hist.messageIds || new Set();
        counts.history_message_ids = historyMessageIds.size;
        
        console.log(`[gmailSyncDelta] History found ${historyMessageIds.size} changed messages, ${hist.deletedIds?.size || 0} deleted`);
        
        // Mark deleted messages
        if (hist.deletedIds?.size > 0) {
          const deletedCount = await markDeleted(base44, hist.deletedIds);
          counts.deleted_count = deletedCount;
        }
        
        // STEP 2: CONDITIONAL inbox reconciliation (only when needed)
        let inboxMissingIds = [];
        const shouldReconcile = 
          force_reconcile === true || 
          historyMessageIds.size === 0 && (!syncState.last_success_at || Date.now() - new Date(syncState.last_success_at).getTime() > 10 * 60 * 1000) ||
          (syncState.consecutive_failures || 0) > 0 ||
          syncState.backfill_mode !== 'off';
        
        if (shouldReconcile) {
          console.log('[gmailSyncDelta] Running inbox reconciliation (conditional)');
          const inboxRecentIds = await listRecentInboxMessageIds({ days: 7, maxResults: 100 });
          inboxMissingIds = await filterMissingEmailMessageIds({ 
            base44, 
            messageIds: inboxRecentIds, 
            maxMissing: 50 
          });
          
          counts.inbox_recent_ids = inboxRecentIds.length;
          counts.inbox_missing_ids = inboxMissingIds.length;
          counts.inbox_reconciled = true;
          
          console.log(`[gmailSyncDelta] Inbox reconcile: ${inboxRecentIds.length} recent, ${inboxMissingIds.length} missing in DB`);
        } else {
          console.log('[gmailSyncDelta] Skipping inbox reconciliation (not needed)');
        }
        
        // STEP 3: Load pending queue
        let pending = new Set();
        try {
          const pendingJson = syncState.pending_message_ids_json || '[]';
          pending = new Set(JSON.parse(pendingJson));
        } catch (err) {
          console.warn('[gmailSyncDelta] Failed to parse pending queue, starting fresh');
        }

        // STEP 4: Union history + inbox + pending
        const newIds = new Set([...Array.from(historyMessageIds), ...inboxMissingIds]);
        newIds.forEach(id => pending.add(id));
        counts.enqueued_count = newIds.size;
        counts.message_ids_changed = pending.size;
        
        console.log(`[gmailSyncDelta] Enqueued: ${newIds.size} new, pending: ${pending.size} total`);
        
        // STEP 5: Drain and process
        if (pending.size > 0) {
          const { counts: processCounts, failedIds } = await processMessageIds({ 
            messageIds: Array.from(pending), 
            base44, 
            runId,
            maxMessagesFetched,
            runStartedAt,
            maxRunMs: MAX_RUN_MS
          });
          Object.assign(counts, processCounts);
          
          // Update pending: remove successfully processed IDs
          const successfulIds = new Set([...pending].filter(id => !failedIds.has(id)));
          counts.drained_count = successfulIds.size;
          
          // Persist updated pending queue
          pending = failedIds;
          syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
            pending_message_ids_json: JSON.stringify(Array.from(pending)),
            backlog_size: pending.size
          });
          
          counts.backlog_remaining = pending.size;
          
          console.log(`[gmailSyncDelta] Drained: ${counts.drained_count}, remaining in backlog: ${pending.size}`);
        } else {
          counts.backlog_remaining = 0;
        }
        
        // Invariant check
        if (unionIds.size > 0 && counts.messages_fetched === 0) {
          console.error('[gmailSyncDelta] INVARIANT VIOLATION: ids collected but not processed');
          return Response.json({
            success: false,
            run_id: runId,
            reason: 'ids-collected-but-not-processed',
            counts
          }, { status: 500 });
        }
        
        // Update state
        syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
          last_history_id: hist.newHistoryId,
          last_delta_sync_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          consecutive_failures: 0
        });

        const elapsedMs = Date.now() - runStartedAt;
        counts.budget_remaining_ms = MAX_RUN_MS - elapsedMs;

        console.log(`[gmailSyncDelta] Delta complete: ${counts.messages_fetched} messages fetched, ${elapsedMs}ms elapsed`);

        return Response.json({
          success: true,
          run_id: runId,
          mode,
          counts,
          new_last_history_id: hist.newHistoryId,
          debug: {
            history: {
              pages: hist.pageCount,
              breakdown: hist.debugBreakdown
            },
            elapsed_ms: elapsedMs
          }
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
      
      // Load pending queue
      let pending = new Set();
      try {
        const pendingJson = syncState.pending_message_ids_json || '[]';
        pending = new Set(JSON.parse(pendingJson));
      } catch (err) {
        console.warn('[gmailSyncDelta] Failed to parse pending queue, starting fresh');
      }

      // Enqueue backfill IDs
      const newIds = messageIds;
      newIds.forEach(id => pending.add(id));
      counts.enqueued_count = newIds.size;
      counts.message_ids_changed = pending.size;
      
      // Process messages
      if (pending.size > 0) {
        const { counts: processCounts, failedIds } = await processMessageIds({ 
          messageIds: Array.from(pending), 
          base44, 
          runId,
          maxMessagesFetched,
          runStartedAt,
          maxRunMs: MAX_RUN_MS
        });
        Object.assign(counts, processCounts);
        
        // Update pending: remove successfully processed IDs
        const successfulIds = new Set([...pending].filter(id => !failedIds.has(id)));
        counts.drained_count = successfulIds.size;
        
        // Persist updated pending queue
        pending = failedIds;
        syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
          pending_message_ids_json: JSON.stringify(Array.from(pending)),
          backlog_size: pending.size
        });
        
        counts.backlog_remaining = pending.size;
        
        console.log(`[gmailSyncDelta] Backfill drained: ${counts.drained_count}, remaining in backlog: ${pending.size}`);
      } else {
        counts.backlog_remaining = 0;
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

      const elapsedMs = Date.now() - runStartedAt;
      counts.budget_remaining_ms = MAX_RUN_MS - elapsedMs;

      console.log(`[gmailSyncDelta] Backfill: ${pageCount} pages, ${messageIds.size} messages, ${counts.messages_fetched} fetched, mode -> ${nextBackfillMode}, ${elapsedMs}ms elapsed`);

      return Response.json({
        success: true,
        run_id: runId,
        mode,
        counts,
        next_backfill_mode: nextBackfillMode,
        debug: {
          elapsed_ms: elapsedMs
        }
      });
    }

    return Response.json({
      success: true,
      run_id: runId,
      mode: 'idle',
      counts,
      debug: {
        elapsed_ms: Date.now() - runStartedAt
      }
    });
  } catch (error) {
    console.error(`[gmailSyncDelta] Error:`, error.message);
    return Response.json(
      { error: error.message, run_id: crypto.randomUUID() },
      { status: 500 }
    );
  }
});