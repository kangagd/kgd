/**
 * gmailRehydrateMissingBodies - Backfill missing message bodies for existing EmailMessage records
 * 
 * - Finds EmailMessage records with has_body=false or empty body fields
 * - Fetches full Gmail message payloads
 * - Parses using robust MIME extraction
 * - Updates EmailMessage with body content + status
 * - Updates parent thread snippets
 * - Rate-limited and retry-safe
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

// ============================================================================
// JWT & Gmail API Helpers (copied from gmailSyncThreadMessages)
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

async function gmailFetch(endpoint, method = 'GET', body = null, queryParams = null, maxRetries = 3) {
  let retries = 0;
  const baseBackoffMs = 1000;

  const getBackoffDelay = (attemptIndex) => {
    const baseDelay = Math.min(baseBackoffMs * Math.pow(2, attemptIndex), 8000);
    const jitter = Math.random() * 1000 - 500;
    return Math.max(baseDelay + jitter, 100);
  };

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

      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && retries < maxRetries - 1) {
          retries++;
          const delay = getBackoffDelay(retries - 1);
          console.log(`[gmailRehydrate] Retry ${retries}/${maxRetries} in ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < maxRetries - 1) {
        retries++;
        const delay = getBackoffDelay(retries - 1);
        console.log(`[gmailRehydrate] Network error, retry ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

// ============================================================================
// MIME Parsing (copied from gmailSyncThreadMessages)
// ============================================================================

function base64urlDecode(base64urlData) {
  try {
    const base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    return '';
  }
}

function htmlToPlainText(html) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/blockquote>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  return text.trim();
}

function extractBodyFromMimeParts(parts, depth = 0) {
  const result = { body_html: '', body_text: '' };
  if (!parts || !Array.isArray(parts) || depth > 10) return result;

  for (const part of parts) {
    if (!part) continue;

    if (part.mimeType === 'text/html' && part.body?.data && !result.body_html) {
      result.body_html = base64urlDecode(part.body.data);
      if (result.body_html && !result.body_text) {
        result.body_text = htmlToPlainText(result.body_html);
      }
    }

    if (part.mimeType === 'text/plain' && part.body?.data && !result.body_text) {
      result.body_text = base64urlDecode(part.body.data);
    }

    if (part.parts && !result.body_html && !result.body_text) {
      const subResult = extractBodyFromMimeParts(part.parts, depth + 1);
      if (subResult.body_html) result.body_html = subResult.body_html;
      if (subResult.body_text) result.body_text = subResult.body_text;
    }
  }

  return result;
}

function extractBodyFromPayload(payload) {
  const result = { body_html: '', body_text: '' };
  if (!payload) return result;

  if (payload.body?.data) {
    const bodyData = base64urlDecode(payload.body.data);
    if (bodyData.includes('<html') || bodyData.includes('<body') || bodyData.includes('<p>')) {
      result.body_html = bodyData;
      result.body_text = htmlToPlainText(bodyData);
    } else {
      result.body_text = bodyData;
    }
  }

  if (payload.parts) {
    const partResult = extractBodyFromMimeParts(payload.parts);
    if (partResult.body_html) result.body_html = partResult.body_html;
    if (partResult.body_text) result.body_text = partResult.body_text;
  }

  return result;
}

function deriveSnippet(bodyText, maxLength = 140) {
  if (!bodyText) return '';
  let snippet = bodyText.trim();
  if (snippet.length > maxLength) {
    snippet = snippet.substring(0, maxLength) + '…';
  }
  return snippet;
}

// ============================================================================
// Rate Limiter
// ============================================================================

async function rateLimitDelay(ms = 300) {
  await new Promise(resolve => setTimeout(resolve, ms));
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
    const requestBody = bodyText ? JSON.parse(bodyText) : {};
    const { limit = 50, thread_id, gmail_thread_id, onlyIfHasBodyFalse = false } = requestBody;

    console.log(`[gmailRehydrate] Starting backfill (limit=${limit}, onlyIfHasBodyFalse=${onlyIfHasBodyFalse})`);

    // Find messages with missing bodies using efficient queries
    let messagesToProcess = [];
    
    try {
      if (onlyIfHasBodyFalse) {
        // Query by has_body flag if supported
        messagesToProcess = await base44.asServiceRole.entities.EmailMessage.filter(
          { has_body: false },
          '-sent_at',
          limit
        );
      } else {
        // Fetch limited set and filter client-side for empty bodies
        const allMessages = await base44.asServiceRole.entities.EmailMessage.list(undefined, limit * 3);
        messagesToProcess = (allMessages || []).filter(m => 
          (!m.body_html || (typeof m.body_html === 'string' && m.body_html.trim() === '')) &&
          (!m.body_text || (typeof m.body_text === 'string' && m.body_text.trim() === ''))
        ).slice(0, limit);
      }

      // Filter by thread_id or gmail_thread_id if provided
      if (thread_id) {
        messagesToProcess = messagesToProcess.filter(m => m.thread_id === thread_id);
      }
      if (gmail_thread_id) {
        messagesToProcess = messagesToProcess.filter(m => m.gmail_thread_id === gmail_thread_id);
      }
    } catch (err) {
      console.error(`[gmailRehydrate] Error fetching messages: ${err.message}`);
      return Response.json(
        { error: `Failed to fetch messages: ${err.message}`, rehydratedCount: 0, successCount: 0, failureCount: 0, threadsUpdated: 0, failures: [] },
        { status: 400 }
      );
    }

    console.log(`[gmailRehydrate] Found ${messagesToProcess.length} messages to process`);

    let rehydratedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    const failures = [];
    const threadsToUpdate = new Set();

    for (const msg of messagesToProcess) {
      try {
        // Fetch full message from Gmail
        const fullMsg = await gmailFetch(
          `/gmail/v1/users/me/messages/${msg.gmail_message_id}`,
          'GET',
          null,
          { format: 'full' }
        );

        if (!fullMsg.payload) {
          throw new Error('No payload in Gmail response');
        }

        // Extract body
        const bodyResult = extractBodyFromPayload(fullMsg.payload);
        const hasBody = !!(bodyResult.body_html || bodyResult.body_text);

        if (!hasBody) {
          throw new Error('No readable MIME parts found');
        }

        // Update message
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.EmailMessage.update(msg.id, {
          body_html: bodyResult.body_html || '',
          body_text: bodyResult.body_text || '',
          has_body: true,
          sync_status: 'ok',
          parse_error: null,
          last_synced_at: now
        });

        rehydratedCount++;
        successCount++;
        threadsToUpdate.add(msg.thread_id);

        console.log(`[gmailRehydrate] ✓ Rehydrated ${msg.gmail_message_id}`);
      } catch (err) {
        failureCount++;
        failures.push({ gmail_message_id: msg.gmail_message_id, reason: err.message });
        console.error(`[gmailRehydrate] ✗ Failed ${msg.gmail_message_id}: ${err.message}`);
      }

      // Rate limit between messages
      await rateLimitDelay(300);
    }

    // Update thread snippets
    console.log(`[gmailRehydrate] Updating ${threadsToUpdate.size} thread(s)...`);
    for (const threadId of threadsToUpdate) {
      try {
        const threadMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          thread_id: threadId,
          has_body: true
        });

        if (threadMessages.length > 0) {
          threadMessages.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
          const latestMsg = threadMessages[0];
          const snippet = latestMsg.body_text ? deriveSnippet(latestMsg.body_text) : '';

          await base44.asServiceRole.entities.EmailThread.update(threadId, {
            snippet: snippet,
            has_preview: !!snippet
          });
        }
      } catch (err) {
        console.error(`[gmailRehydrate] Error updating thread ${threadId}:`, err.message);
      }
    }

    console.log(`[gmailRehydrate] Complete: rehydrated=${rehydratedCount}, success=${successCount}, failed=${failureCount}`);

    return Response.json({
      success: true,
      rehydratedCount,
      successCount,
      failureCount,
      threadsUpdated: threadsToUpdate.size,
      failures
    });
  } catch (error) {
    console.error('[gmailRehydrate] Fatal error:', error.message);
    return Response.json(
      { error: error.message, rehydratedCount: 0, successCount: 0, failureCount: 0, threadsUpdated: 0, failures: [] },
      { status: 500 }
    );
  }
});