/**
 * Gmail Domain-Wide Delegation Client
 * Uses Google Service Account with JWT auth to impersonate a shared mailbox
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Generate JWT for Google Service Account with subject impersonation
 */
function createJWT(serviceAccountEmail, privateKey, subject) {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iss: serviceAccountEmail,
    sub: subject, // Impersonate this user
    scope: GMAIL_SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  // Import private key and sign
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  ).then(key => {
    const encoder = new TextEncoder();
    return crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(signatureInput)
    );
  }).then(signature => {
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    return `${signatureInput}.${encodedSignature}`;
  });
}

/**
 * Convert PEM private key to ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const pemContent = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryString = atob(pemContent);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

/**
 * Get Gmail access token using Domain-Wide Delegation
 * @returns {Promise<string>} Access token
 */
export async function getGmailAccessToken() {
  const serviceAccountEmail = Deno.env.get('GOOGLE_WORKSPACE_SERVICE_ACCOUNT_CLIENT_EMAIL');
  const privateKeyRaw = Deno.env.get('GOOGLE_WORKSPACE_SERVICE_ACCOUNT_PRIVATE_KEY');
  const impersonateEmail = Deno.env.get('GMAIL_DWD_IMPERSONATE_EMAIL') || 'admin@kangaroogd.com.au';
  
  if (!serviceAccountEmail) {
    throw new Error('Missing GOOGLE_WORKSPACE_SERVICE_ACCOUNT_CLIENT_EMAIL environment variable');
  }
  
  if (!privateKeyRaw) {
    throw new Error('Missing GOOGLE_WORKSPACE_SERVICE_ACCOUNT_PRIVATE_KEY environment variable');
  }
  
  // Handle escaped newlines in private key
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  
  // Create JWT with subject impersonation
  const jwt = await createJWT(serviceAccountEmail, privateKey, impersonateEmail);
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Make authenticated Gmail API request
 * @param {string} endpoint - Gmail API endpoint path (e.g., '/gmail/v1/users/me/profile')
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} body - Request body (for POST/PUT)
 * @param {object} queryParams - URL query parameters
 * @returns {Promise<object>} Response data
 */
export async function gmailDwdFetch(endpoint, method = 'GET', body = null, queryParams = null) {
  const accessToken = await getGmailAccessToken();
  
  let url = `https://gmail.googleapis.com${endpoint}`;
  
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${error}`);
  }
  
  return response.json();
}