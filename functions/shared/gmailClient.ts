// Shared Gmail client using Service Account + Domain-Wide Delegation
// This eliminates per-user OAuth and centralizes Gmail authentication

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Build a JWT for Google Service Account impersonation
 * @param {object} serviceAccountJson - Parsed service account JSON
 * @param {string} impersonateEmail - Email to impersonate (e.g., admin@kangaroogd.com.au)
 * @param {string[]} scopes - OAuth scopes
 * @returns {string} Signed JWT
 */
function buildGoogleJWT(serviceAccountJson, impersonateEmail, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccountJson.client_email,
    sub: impersonateEmail, // Impersonate this user
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry
  };

  // Base64URL encode
  const base64url = (str) => btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(payload));
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  // Import private key and sign
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccountJson.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  ).then(privateKey => {
    return crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(unsignedToken)
    );
  }).then(signature => {
    const signatureEncoded = base64url(String.fromCharCode(...new Uint8Array(signature)));
    return `${unsignedToken}.${signatureEncoded}`;
  });
}

/**
 * Convert PEM private key to ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Get an access token using Service Account impersonation
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

  if (!serviceAccountJson || !impersonateEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_IMPERSONATE_USER_EMAIL');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const jwt = await buildGoogleJWT(serviceAccount, impersonateEmail, GMAIL_SCOPES);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Make a Gmail API request with retries and error handling
 * @param {string} path - API path (e.g., '/gmail/v1/users/me/threads')
 * @param {string} method - HTTP method
 * @param {object} body - Request body
 * @param {object} queryParams - Query parameters
 * @param {number} retries - Number of retries for 429/5xx errors
 * @returns {Promise<object>} API response
 */
async function gmailFetch(path, method = 'GET', body = null, queryParams = {}, retries = 3) {
  const accessToken = await getAccessToken();
  
  // Build URL with query params
  const url = new URL(`https://gmail.googleapis.com${path}`);
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

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

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), options);

      // Retry on rate limit or server errors
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${error}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Gmail API request failed after retries');
}

export { getAccessToken, gmailFetch, GMAIL_SCOPES };