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

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { emails, projectId } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
       return Response.json({ error: 'Emails array required' }, { status: 400 });
    }

    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query: "from:(email1 OR email2) OR to:(email1 OR email2)"
    const emailQuery = emails.map(e => `"${e}"`).join(' OR ');
    const q = `from:(${emailQuery}) OR to:(${emailQuery})`;

    // List messages using service account
    const listData = await gmailFetch('/gmail/v1/users/me/messages', 'GET', null, {
      q,
      maxResults: 50
    });

    const messages = listData.messages || [];

    if (messages.length === 0) {
        return Response.json({ messages: [] });
    }

    // Fetch metadata for each message
    const results = await Promise.all(messages.map(async (msg) => {
        try {
            const detail = await gmailFetch(
                `/gmail/v1/users/me/messages/${msg.id}`,
                'GET',
                null,
                { format: 'metadata', metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Message-ID'] }
            );
            
            const headers = detail.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const to = headers.find(h => h.name === 'To')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value;
            
            const fromAddress = parseEmailAddress(from);
            const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
            const isOutbound = fromAddress.toLowerCase() === impersonateEmail.toLowerCase() || detail.labelIds?.includes('SENT');
            const sentAt = date ? new Date(date).toISOString() : new Date().toISOString();

            // Upsert to ProjectEmail if projectId is provided
            if (projectId) {
              try {
                const existing = await base44.asServiceRole.entities.ProjectEmail.filter({ 
                  project_id: projectId, 
                  gmail_message_id: msg.id 
                });

                if (existing.length === 0) {
                  await base44.asServiceRole.entities.ProjectEmail.create({
                    project_id: projectId,
                    gmail_message_id: msg.id,
                    thread_id: detail.threadId,
                    subject: subject,
                    snippet: detail.snippet,
                    from_email: fromAddress,
                    to_email: to,
                    direction: isOutbound ? 'outgoing' : 'incoming',
                    sent_at: sentAt,
                    is_historical: true,
                    source: 'gmail',
                    created_at: new Date().toISOString()
                  });
                }
              } catch (err) {
                console.error(`Failed to upsert ProjectEmail for ${msg.id}:`, err);
              }
            }

            return {
                gmail_message_id: msg.id,
                thread_id: detail.threadId,
                subject,
                snippet: detail.snippet,
                sent_at: sentAt,
                is_outbound: isOutbound,
                from_address: fromAddress,
                from_name: from.replace(/<.*>/, '').trim(),
                to_addresses: to ? to.split(',').map(e => parseEmailAddress(e.trim())) : [],
                isHistorical: true,
                body_text: detail.snippet,
                attachments: []
            };
        } catch (e) {
            console.error(`Failed to fetch details for ${msg.id}`, e);
            return null;
        }
    }));

    return Response.json({ messages: results.filter(Boolean) });

  } catch (error) {
    console.error('Historical search error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});