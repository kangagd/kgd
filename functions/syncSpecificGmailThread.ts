/**
 * syncSpecificGmailThread - Fetch and sync a specific Gmail thread with full message bodies
 * 
 * Uses service account (shared inbox) to fetch full thread details.
 * Creates/updates EmailThread and EmailMessage records.
 * Optionally links thread to a project.
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

function decodeBase64(str) {
  try {
    return decodeURIComponent(atob(str).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch {
    return str;
  }
}

function extractEmailBody(payload) {
  if (!payload) return '';

  // Check for plain text body first
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Recursively search parts for text/plain or text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    // Fall back to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
  }

  return '';
}

function extractAttachments(payload, messageId) {
  const attachments = [];

  if (!payload || !payload.parts) return attachments;

  for (const part of payload.parts) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        size: part.body.size || 0,
        mime_type: part.mimeType || 'application/octet-stream',
        attachment_id: part.body.attachmentId,
        gmail_message_id: messageId,
        is_inline: false
      });
    }
  }

  return attachments;
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

    const bodyText = await req.text();
    const { gmail_thread_id, project_id = null } = JSON.parse(bodyText || '{}');

    if (!gmail_thread_id) {
      return Response.json({ error: 'Missing gmail_thread_id' }, { status: 400 });
    }

    stage = 'fetch_thread';
    console.log(`[syncSpecificGmailThread] Fetching thread ${gmail_thread_id} with full format`);

    // Fetch thread with FULL message bodies
    const threadDetail = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}`,
      'GET',
      null,
      { format: 'full' }
    );

    if (!threadDetail.messages || threadDetail.messages.length === 0) {
      return Response.json({ error: 'Thread has no messages' }, { status: 400 });
    }

    const messages = threadDetail.messages;
    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];

    // Extract thread metadata from last message
    const lastHeaders = {};
    if (lastMsg.payload?.headers) {
      lastMsg.payload.headers.forEach(h => {
        lastHeaders[h.name.toLowerCase()] = h.value;
      });
    }

    const subject = lastHeaders['subject'] || '(no subject)';
    const fromAddress = lastHeaders['from'] || '';
    const toAddresses = lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [];
    const lastMsgDate = lastMsg.internalDate ? new Date(parseInt(lastMsg.internalDate)).toISOString() : new Date().toISOString();

    stage = 'upsert_thread';

    // Check if thread already exists
    const existing = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id: gmail_thread_id
    });

    const threadData = {
      subject,
      gmail_thread_id: gmail_thread_id,
      from_address: fromAddress,
      to_addresses: toAddresses,
      last_message_date: lastMsgDate,
      last_message_snippet: threadDetail.snippet || '',
      message_count: messages.length,
      is_read: !messages.some(m => m.labels?.includes('UNREAD')),
      status: 'Open',
      last_activity_at: lastMsgDate
    };

    if (project_id) {
      threadData.project_id = project_id;
    }

    let threadId;
    if (existing.length > 0) {
      threadId = existing[0].id;
      await base44.asServiceRole.entities.EmailThread.update(threadId, threadData);
      console.log(`[syncSpecificGmailThread] Updated thread ${gmail_thread_id}`);
    } else {
      const newThread = await base44.asServiceRole.entities.EmailThread.create(threadData);
      threadId = newThread.id;
      console.log(`[syncSpecificGmailThread] Created thread ${gmail_thread_id}`);
    }

    stage = 'upsert_messages';

    // Create/update EmailMessage records for each message
    const messageRecords = [];
    for (const msg of messages) {
      const headers = {};
      if (msg.payload?.headers) {
        msg.payload.headers.forEach(h => {
          headers[h.name.toLowerCase()] = h.value;
        });
      }

      const body = extractEmailBody(msg.payload);
      const attachments = extractAttachments(msg.payload, msg.id);

      const msgData = {
        thread_id: threadId,
        gmail_message_id: msg.id,
        gmail_thread_id: gmail_thread_id,
        from_address: headers['from'] || '',
        from_name: headers['from'] || '',
        to_addresses: headers['to'] ? headers['to'].split(',').map(e => e.trim()) : [],
        cc_addresses: headers['cc'] ? headers['cc'].split(',').map(e => e.trim()) : [],
        bcc_addresses: headers['bcc'] ? headers['bcc'].split(',').map(e => e.trim()) : [],
        sent_at: headers['date'] ? new Date(headers['date']).toISOString() : new Date().toISOString(),
        subject: headers['subject'] || '',
        body_html: body,
        body_text: body,
        attachments: attachments,
        is_outbound: fromAddress.includes('kangaroogd'),
        message_id: headers['message-id'] || '',
        in_reply_to: headers['in-reply-to'] || '',
        references: headers['references'] || ''
      };

      // Check if message already exists
      const existingMsg = await base44.asServiceRole.entities.EmailMessage.filter({
        gmail_message_id: msg.id
      });

      if (existingMsg.length > 0) {
        await base44.asServiceRole.entities.EmailMessage.update(existingMsg[0].id, msgData);
      } else {
        await base44.asServiceRole.entities.EmailMessage.create(msgData);
      }

      messageRecords.push(msg.id);
    }

    console.log(`[syncSpecificGmailThread] Synced ${messageRecords.length} messages`);

    return Response.json({
      success: true,
      thread_id: threadId,
      gmail_thread_id: gmail_thread_id,
      messageCount: messageRecords.length,
      linkedToProject: !!project_id
    });
  } catch (error) {
    console.error(`[syncSpecificGmailThread] Error at stage '${stage}':`, error);
    return Response.json(
      { error: error.message, stage },
      { status: 500 }
    );
  }
});