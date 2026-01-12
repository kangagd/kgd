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

async function getServiceAccountAccessToken() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

  if (!serviceAccountJson || !impersonateEmail) {
    throw new Error('Missing service account configuration');
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
    throw new Error(`Failed to get service account token: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function refreshTokenIfNeeded(user, base44) {
  const expiry = new Date(user.gmail_token_expiry);
  const now = new Date();
  
  if (expiry - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: user.gmail_refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      })
    });
    
    const tokens = await tokenResponse.json();
    
    await base44.asServiceRole.entities.User.update(user.id, {
      gmail_access_token: tokens.access_token,
      gmail_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.gmail_access_token;
}

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (users.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    
    const user = users[0];

    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
    }
    
    const accessToken = await refreshTokenIfNeeded(user, base44);

    const { query, sender, recipient, dateFrom, dateTo, maxResults = 50 } = await req.json();

    if (!query && !sender && !recipient) {
      return Response.json({ error: 'At least one search parameter required' }, { status: 400 });
    }

    // Build Gmail search query
    const queryParts = [];
    if (query) queryParts.push(query);
    if (sender) queryParts.push(`from:${sender}`);
    if (recipient) queryParts.push(`to:${recipient}`);
    if (dateFrom) queryParts.push(`after:${dateFrom.replace(/-/g, '/')}`);
    if (dateTo) queryParts.push(`before:${dateTo.replace(/-/g, '/')}`);
    
    const gmailQuery = queryParts.join(' ');
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=${maxResults}`;
    
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Gmail API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    const messageIds = data.messages || [];

    if (messageIds.length === 0) {
      return Response.json({ threads: [], found: 0 });
    }

    // Fetch thread details for display
    const threadMap = new Map();
    const MAX_THREADS = 20; // Limit for performance
    
    for (const msg of messageIds.slice(0, MAX_THREADS)) {
      try {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const msgResponse = await fetch(msgUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!msgResponse.ok) continue;

        const detail = await msgResponse.json();
        const headers = detail.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const gmailThreadId = detail.threadId;

        if (!threadMap.has(gmailThreadId)) {
          // Check if already synced
          const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
            gmail_thread_id: gmailThreadId
          });

          threadMap.set(gmailThreadId, {
            gmail_thread_id: gmailThreadId,
            subject,
            from,
            snippet: detail.snippet || '',
            date,
            is_synced: existingThreads.length > 0,
            synced_id: existingThreads.length > 0 ? existingThreads[0].id : null
          });
        }
      } catch (err) {
        console.error(`Error fetching message ${msg.id}:`, err);
      }
    }

    const threads = Array.from(threadMap.values());
    return Response.json({ threads, found: messageIds.length });
  } catch (error) {
    console.error('Search Gmail history error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});