/**
 * gmailSyncInbox - Sync Gmail inbox threads into Base44
 * 
 * Pulls threads from the shared Gmail inbox (admin@kangaroogd.com.au)
 * and upserts EmailThread records. Does NOT pull full message bodies here.
 * 
 * Called periodically (scheduled task) or on-demand from frontend.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

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
    scope: GMAIL_SCOPES.join(' '),
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
    throw new Error(`Failed to get access token: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function gmailFetch(endpoint, method = 'GET', body = null, queryParams = null) {
  let retries = 0;
  const maxRetries = 3;
  const backoffMs = 1000;

  while (retries < maxRetries) {
    try {
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

      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Max retries exceeded. Last status: ${response.status}`);
        }
        const waitMs = backoffMs * Math.pow(2, retries - 1);
        console.log(`[gmailFetch] Retrying in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < maxRetries - 1) {
        retries++;
        const waitMs = backoffMs * Math.pow(2, retries - 1);
        console.log(`[gmailFetch] Retry ${retries}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
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
          is_read: !threadDetail.messages.some(m => m.labels?.includes('UNREAD')),
          status: 'Open',
          last_activity_at: lastMsgDate
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