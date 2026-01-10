/**
 * Gmail Client V2 - Service Account + Domain-Wide Delegation
 * 
 * This is the ONLY entry point for Gmail API calls.
 * All email functions must use this client.
 * 
 * DO NOT reintroduce per-user OAuth tokens or per-user Gmail refresh tokens.
 * DO NOT call Gmail API from frontend.
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Validate that all required env vars are set
 */
function validateGmailEnv() {
  const required = {
    'GOOGLE_SERVICE_ACCOUNT_JSON': Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON'),
    'GOOGLE_IMPERSONATE_USER_EMAIL': Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL')
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }

  return true;
}

/**
 * Convert PEM private key string (with escaped \n) to proper format
 */
function formatPrivateKey(keyString) {
  if (!keyString) throw new Error('Private key is empty');
  
  // If it has escaped newlines (\n as literal chars), convert them
  const key = keyString.replace(/\\n/g, '\n');
  return key;
}

/**
 * Create a JWT for Service Account authentication
 */
async function createJWT(serviceAccountJson, impersonateEmail) {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountJson.client_email,
    sub: impersonateEmail, // Domain-Wide Delegation: impersonate this user
    scope: GMAIL_SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1 hour
    iat: now
  };

  const headerEncoded = btoa(JSON.stringify(header))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadEncoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Import private key and sign
  const key = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(formatPrivateKey(serviceAccountJson.private_key)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signatureInput}.${signatureEncoded}`;
}

/**
 * Get access token using JWT bearer flow
 */
async function getAccessToken() {
  try {
    validateGmailEnv();

    const serviceAccountJson = JSON.parse(
      Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    );
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

    const jwt = await createJWT(serviceAccountJson, impersonateEmail);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token error: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[gmailClientV2] getAccessToken failed:', error);
    throw error;
  }
}

/**
 * Make an authenticated request to Gmail API
 * 
 * @param path - API path, e.g. /gmail/v1/users/me/messages/send
 * @param method - HTTP method (GET, POST, etc.)
 * @param body - Request body (null for GET)
 * @param query - Query parameters object
 * @returns - Parsed JSON response
 */
async function gmailFetch(path, method = 'GET', body = null, query = {}) {
  try {
    const accessToken = await getAccessToken();

    // Build URL with query params
    let url = `https://www.googleapis.com${path}`;
    const queryString = new URLSearchParams(query).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gmailClientV2] API error (${response.status}):`, errorText);
      throw new Error(`Gmail API error ${response.status}: ${errorText}`);
    }

    // Some endpoints return empty response (e.g., send)
    const text = await response.text();
    if (!text) return {};

    return JSON.parse(text);
  } catch (error) {
    console.error('[gmailClientV2] gmailFetch error:', error);
    throw error;
  }
}

export { validateGmailEnv, getAccessToken, gmailFetch };