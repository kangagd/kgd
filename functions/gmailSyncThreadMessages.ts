/**
 * gmailSyncThreadMessages - Sync messages for a single Gmail thread
 * 
 * Fetches full message details for a specific thread and upserts EmailMessage records.
 * Safe, idempotent operation - can be called multiple times without duplicates.
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
          console.log(`[gmailSyncThreadMessages] Retry ${retries}/${maxRetries} in ${Math.round(delay)}ms`);
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
        console.log(`[gmailSyncThreadMessages] Network error, retry ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

async function extractBodyParts(part) {
  const result = { body_html: '', body_text: '' };
  if (!part) return result;
  
  // Extract text/html
  if (part.mimeType === 'text/html' && part.body?.data) {
    try {
      result.body_html = decodeURIComponent(escape(atob(part.body.data)));
    } catch {
      // ignore
    }
  }

  // Extract text/plain
  if (part.mimeType === 'text/plain' && part.body?.data) {
    try {
      result.body_text = decodeURIComponent(escape(atob(part.body.data)));
    } catch {
      // ignore
    }
  }

  // Recurse into multipart
  if (part.parts && Array.isArray(part.parts)) {
    for (const subpart of part.parts) {
      const subResult = await extractBodyParts(subpart);
      if (subResult.body_html && !result.body_html) result.body_html = subResult.body_html;
      if (subResult.body_text && !result.body_text) result.body_text = subResult.body_text;
    }
  }

  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};
    const { gmail_thread_id } = requestBody;

    if (!gmail_thread_id) {
      return Response.json(
        { error: 'Missing required field: gmail_thread_id' },
        { status: 400 }
      );
    }

    console.log(`[gmailSyncThreadMessages] Syncing thread: ${gmail_thread_id}`);

    // Fetch thread with full message details
    const threadDetail = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}`,
      'GET',
      null,
      { format: 'full' }
    );

    if (!threadDetail.messages || threadDetail.messages.length === 0) {
      return Response.json({ success: true, thread_id: null, message_count: 0 });
    }

    // Find EmailThread by gmail_thread_id
    const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id: gmail_thread_id
    });

    let threadId = null;
    if (existingThreads.length > 0) {
      threadId = existingThreads[0].id;
    } else {
      // Create minimal EmailThread if doesn't exist
      const firstMsg = threadDetail.messages[0];
      const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
      
      const lastHeaders = {};
      if (lastMsg.payload?.headers) {
        lastMsg.payload.headers.forEach(h => {
          lastHeaders[h.name.toLowerCase()] = h.value;
        });
      }

      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        subject: lastHeaders['subject'] || '(no subject)',
        gmail_thread_id: gmail_thread_id,
        from_address: lastHeaders['from'] || '',
        to_addresses: lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [],
        last_message_date: new Date().toISOString(),
        message_count: threadDetail.messages.length
      });
      threadId = newThread.id;
    }

    // Upsert messages
    let upsertedCount = 0;
    for (const gmailMsg of threadDetail.messages) {
      try {
        const headers = {};
        if (gmailMsg.payload?.headers) {
          gmailMsg.payload.headers.forEach(h => {
            headers[h.name.toLowerCase()] = h.value;
          });
        }

        const { body_html, body_text } = await extractBodyParts(gmailMsg.payload);

        const existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: gmailMsg.id
        });

        const messageData = {
          thread_id: threadId,
          gmail_message_id: gmailMsg.id,
          gmail_thread_id: gmail_thread_id,
          from_address: headers['from'] || '',
          from_name: headers['from'] || '',
          to_addresses: headers['to'] ? headers['to'].split(',').map(e => e.trim()) : [],
          cc_addresses: headers['cc'] ? headers['cc'].split(',').map(e => e.trim()) : [],
          subject: headers['subject'] || '',
          body_html: body_html || '',
          body_text: body_text || '',
          sent_at: headers['date'] ? new Date(headers['date']).toISOString() : new Date().toISOString(),
          is_outbound: headers['from']?.includes('kangaroogd.com.au') || false
        };

        if (existingMessages.length > 0) {
          await base44.asServiceRole.entities.EmailMessage.update(existingMessages[0].id, messageData);
        } else {
          await base44.asServiceRole.entities.EmailMessage.create(messageData);
        }
        upsertedCount++;
      } catch (err) {
        console.error(`[gmailSyncThreadMessages] Error processing message ${gmailMsg.id}:`, err);
      }
    }

    return Response.json({
      success: true,
      thread_id: threadId,
      message_count: upsertedCount
    });
  } catch (error) {
    console.error('[gmailSyncThreadMessages] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});