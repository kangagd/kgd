/**
 * gmailSyncInbox - Sync Gmail inbox threads into Base44
 * 
 * Pulls threads from the shared Gmail inbox (admin@kangaroogd.com.au)
 * and upserts EmailThread records. Does NOT pull full message bodies here.
 * 
 * Called periodically (scheduled task) or on-demand from frontend.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// Category Detection (Pattern-based)
// ============================================================================

const CATEGORY_PATTERNS = {
  supplier_invoice: [
    /\btax invoice\b/i,
    /\binvoice\b/i,
    /\bstatement\b/i,
    /\bamount due\b/i,
    /\bpayable\b/i,
    /\bremit(tance)?\b/i,
    /\bpro[- ]?forma\b/i,
  ],
  customer_quote: [
    /kangaroogd:\s*quote\s*for/i,
    /\bour\s+quote\b/i,
    /\byour\s+(requested\s+)?quote\b/i,
  ],
  supplier_quote: [
    /\bquote\s+request\s*#/i,
    /\bquote\b/i,
    /\bquotation\b/i,
    /\bpricing\b/i,
    /\bestimate\b/i,
    /\bprice\b/i,
  ],
  payment: [
    /\bpayment received\b/i,
    /\bpaid\b/i,
    /\bpaid in full\b/i,
    /\breceipt\b/i,
    /\bdeposit\b/i,
    /\bremittance\b/i,
    /\btransfer\b/i,
  ],
  booking: [
    /\bbooking\b/i,
    /\bschedule\b/i,
    /\bappointment\b/i,
    /\bsite visit\b/i,
    /\binstall\b/i,
    /\breschedule\b/i,
    /\bconfirm (a )?time\b/i,
    /\bwhat time\b/i,
    /\bdate\b/i,
    /\bavailability\b/i,
  ],
  order_confirmation: [
    /\border confirmation\b/i,
    /\bpurchase order\b/i,
    /\bpo\b/i,
    /\border (has been )?(placed|confirmed)\b/i,
    /\bdispatch(ed)?\b/i,
    /\btracking\b/i,
    /\bready for pickup\b/i,
    /\bcollection\b/i,
    /\bdelivery\b/i,
    /\beta\b/i,
    /\bback[- ]?order(ed)?\b/i,
  ],
  client_query: [
    /\?/,
    /\bcan you\b/i,
    /\bcould you\b/i,
    /\bplease\b/i,
    /\bhow\b/i,
    /\bwhen\b/i,
    /\bwhy\b/i,
    /\bissue\b/i,
    /\bproblem\b/i,
    /\bnot working\b/i,
    /\bbroken\b/i,
    /\bwarranty\b/i,
    /\bchange\b/i,
    /\bupdate\b/i,
    /\bcancel\b/i,
  ],
};

function matchesAny(text, patterns) {
  const s = String(text || '');
  return patterns.some(r => r.test(s));
}

function determineCategory(subject, snippet) {
  const combined = `${subject}\n${snippet}`;
  const scores = [];

  // Strong signals from subject (prioritize customer_quote over supplier_quote)
  if (matchesAny(subject, CATEGORY_PATTERNS.customer_quote)) scores.push({ value: 'customer_quote', score: 95 });
  if (matchesAny(subject, CATEGORY_PATTERNS.order_confirmation)) scores.push({ value: 'order_confirmation', score: 90 });
  if (matchesAny(subject, CATEGORY_PATTERNS.supplier_invoice)) scores.push({ value: 'supplier_invoice', score: 85 });
  if (matchesAny(subject, CATEGORY_PATTERNS.supplier_quote)) scores.push({ value: 'supplier_quote', score: 75 });

  // Medium signals from combined text
  if (matchesAny(combined, CATEGORY_PATTERNS.customer_quote)) scores.push({ value: 'customer_quote', score: 65 });
  if (matchesAny(combined, CATEGORY_PATTERNS.order_confirmation)) scores.push({ value: 'order_confirmation', score: 60 });
  if (matchesAny(combined, CATEGORY_PATTERNS.supplier_invoice)) scores.push({ value: 'supplier_invoice', score: 55 });
  if (matchesAny(combined, CATEGORY_PATTERNS.payment)) scores.push({ value: 'payment', score: 50 });
  if (matchesAny(combined, CATEGORY_PATTERNS.booking)) scores.push({ value: 'booking', score: 45 });
  if (matchesAny(combined, CATEGORY_PATTERNS.supplier_quote)) scores.push({ value: 'supplier_quote', score: 40 });
  if (matchesAny(combined, CATEGORY_PATTERNS.client_query)) scores.push({ value: 'client_query', score: 35 });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score < 40) return 'uncategorised';
  return best.value;
}

// ============================================================================
// Gmail API Helper with App Connector
// ============================================================================

async function gmailFetch(base44, endpoint, method = 'GET', body = null, queryParams = null) {
  let retries = 0;
  const maxRetries = 4;
  const baseBackoffMs = 1000;

  const shouldRetry = (status) => {
    // Transient errors only: 429, 5xx, network errors
    if (status === 429 || (status >= 500 && status < 600)) return true;
    // Don't retry deterministic errors (4xx except 429)
    return false;
  };

  const getBackoffDelay = (attemptIndex) => {
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s (±500ms)
    const baseDelay = Math.min(baseBackoffMs * Math.pow(2, attemptIndex), 8000);
    const jitter = Math.random() * 1000 - 500; // ±500ms
    return Math.max(baseDelay + jitter, 100);
  };

  while (retries < maxRetries) {
    try {
      const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");
      
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

      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        // Check if we should retry this error
        if (shouldRetry(response.status) && retries < maxRetries - 1) {
          retries++;
          const delay = getBackoffDelay(retries - 1);
          console.log(`[gmailFetch] Transient error ${response.status}, retry ${retries}/${maxRetries} in ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // Don't retry: deterministic error or max retries reached
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      // Network error - retry with backoff
      if (retries < maxRetries - 1) {
        retries++;
        const delay = getBackoffDelay(retries - 1);
        console.log(`[gmailFetch] Network error, retry ${retries}/${maxRetries} in ${Math.round(delay)}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

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

    const listResult = await gmailFetch(base44, '/gmail/v1/users/me/threads', 'GET', null, queryParams);
    const threads = listResult.threads || [];
    
    console.log(`[gmailSyncInbox] Found ${threads.length} threads`);

    stage = 'upsert_threads';
    const upsertedThreads = [];

    // Batch fetch all thread details in parallel (max 5 concurrent to avoid rate limits)
    const batchSize = 5;
    const threadDetails = await Promise.all(
      threads.map(t => 
        gmailFetch(base44, `/gmail/v1/users/me/threads/${t.id}`, 'GET', null, { format: 'metadata' })
          .catch(err => {
            console.error(`[gmailSyncInbox] Failed to fetch thread ${t.id}:`, err.message);
            return null;
          })
      )
    );

    // Batch fetch all existing threads by gmail_thread_id
    const gmailThreadIds = threads.map(t => t.id);
    const existingThreadsMap = {};
    if (gmailThreadIds.length > 0) {
      const existing = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id: { $in: gmailThreadIds }
      });
      existing.forEach(t => {
        existingThreadsMap[t.gmail_thread_id] = t.id;
      });
    }

    // Process threads sequentially for upsert (batched fetches complete)
    for (let i = 0; i < threads.length; i++) {
      const gmailThread = threads[i];
      const threadDetail = threadDetails[i];

      try {
        if (!threadDetail || !threadDetail.messages || threadDetail.messages.length === 0) {
          console.log(`[gmailSyncInbox] Thread ${gmailThread.id} has no messages, skipping`);
          continue;
        }

        const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
        const lastHeaders = {};
        if (lastMsg.payload?.headers) {
          lastMsg.payload.headers.forEach(h => {
            lastHeaders[h.name.toLowerCase()] = h.value;
          });
        }

        const subject = lastHeaders['subject'] || '(no subject)';
        const fromAddress = lastHeaders['from'] || '';
        const toAddresses = lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [];

        // Skip Wix CRM emails
        if (fromAddress.includes('no-reply@crm.wix.com')) {
          console.log(`[gmailSyncInbox] Skipping Wix CRM email thread ${gmailThread.id}`);
          continue;
        }

        let snippet = threadDetail.snippet || '';
        if (snippet.length > 200) {
          snippet = snippet.substring(0, 200) + '...';
        }

        const lastMsgDate = lastMsg.internalDate ? new Date(parseInt(lastMsg.internalDate)).toISOString() : new Date().toISOString();

        const threadData = {
          subject,
          gmail_thread_id: gmailThread.id,
          from_address: fromAddress,
          to_addresses: toAddresses,
          last_message_date: lastMsgDate,
          last_message_snippet: snippet || '',
          snippet: snippet || '',
          message_count: threadDetail.messages.length,
          isUnread: threadDetail.messages.some(m => m.labels?.includes('UNREAD')),
          status: 'Open',
          last_activity_at: lastMsgDate
        };

        const existingId = existingThreadsMap[gmailThread.id];
        if (existingId) {
          await base44.asServiceRole.entities.EmailThread.update(existingId, threadData);
          upsertedThreads.push({
            id: existingId,
            gmail_thread_id: gmailThread.id,
            action: 'updated'
          });
          console.log(`[gmailSyncInbox] Updated thread ${gmailThread.id}`);
        } else {
          const newThread = await base44.asServiceRole.entities.EmailThread.create(threadData);
          upsertedThreads.push({
            id: newThread.id,
            gmail_thread_id: gmailThread.id,
            action: 'created'
          });
          console.log(`[gmailSyncInbox] Created thread ${gmailThread.id}`);
        }
      } catch (err) {
        console.error(`[gmailSyncInbox] Error processing thread ${gmailThread.id}:`, err.message);
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