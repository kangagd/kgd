import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetch full messages for a specific Gmail thread and create EmailMessage records
 * Called when user opens a thread with no messages
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
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
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          continue;
        }
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < maxRetries - 1) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.text();
    const { thread_id, gmail_thread_id } = body ? JSON.parse(body) : {};

    if (!thread_id || !gmail_thread_id) {
      return Response.json({ error: 'Missing thread_id or gmail_thread_id' }, { status: 400 });
    }

    console.log(`[fetchThreadMessages] Fetching messages for Gmail thread ${gmail_thread_id}`);

    // Fetch thread with full message content
    const threadDetail = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}`,
      'GET'
    );

    if (!threadDetail.messages || threadDetail.messages.length === 0) {
      return Response.json({ 
        success: true,
        fetched: 0,
        message: 'Thread has no messages in Gmail'
      });
    }

    let created = 0;
    let skipped = 0;

    // Process each message
    for (const message of threadDetail.messages) {
      try {
        // Check if message already exists
        const existing = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: message.id
        });

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        const detail = await gmailFetch(
          `/gmail/v1/users/me/messages/${message.id}`,
          'GET'
        );

        if (!detail?.payload?.headers) {
          console.warn(`Invalid message format for ${message.id}`);
          continue;
        }

        const headers = detail.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const messageId = headers.find(h => h.name === 'Message-ID')?.value;

        if (!date) continue;

        // Extract body
        let bodyHtml = '';
        let bodyText = detail.snippet || '';
        const attachments = [];

        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            try {
              if (part.mimeType === 'text/html' && part.body?.data) {
                const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                if (decoded) bodyHtml = decoded;
              } else if (part.mimeType === 'text/plain' && part.body?.data) {
                const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                if (decoded) bodyText = decoded;
              }

              if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
                attachments.push({
                  filename: part.filename,
                  mime_type: part.mimeType,
                  size: parseInt(part.body.size) || 0,
                  attachment_id: part.body.attachmentId,
                  gmail_message_id: message.id
                });
              }

              if (part.parts) processParts(part.parts);
            } catch (e) {
              console.error('Error processing part:', e);
            }
          }
        };

        if (detail.payload.parts) processParts(detail.payload.parts);

        const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
        const isOutbound = detail.labelIds?.includes('SENT') || 
                          parseEmailAddress(from).toLowerCase() === impersonateEmail.toLowerCase();

        const messageData = {
          thread_id,
          gmail_message_id: message.id,
          gmail_thread_id,
          from_address: parseEmailAddress(from),
          to_addresses: to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [],
          sent_at: new Date(date).toISOString(),
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          message_id: messageId || message.id,
          is_outbound: isOutbound,
          attachments: attachments.length > 0 ? attachments : undefined
        };

        await base44.asServiceRole.entities.EmailMessage.create(messageData);
        created++;

        // Delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError.message);
      }
    }

    console.log(`[fetchThreadMessages] Created ${created} messages, skipped ${skipped}`);

    return Response.json({
      success: true,
      fetched: created,
      skipped,
      total: threadDetail.messages.length
    });

  } catch (error) {
    console.error('[fetchThreadMessages] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});