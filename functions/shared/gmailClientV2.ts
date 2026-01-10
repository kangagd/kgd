/**
 * Gmail Client V2 - DWD-based centralized Gmail API access
 * 
 * Uses Google Service Account with Domain-Wide Delegation to impersonate
 * the shared mailbox (admin@kangaroogd.com.au).
 * 
 * Environment variables required:
 *   - GOOGLE_SERVICE_ACCOUNT_JSON: Service account credentials (JSON string)
 *   - GOOGLE_IMPERSONATE_USER_EMAIL: Email to impersonate (admin@kangaroogd.com.au)
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

/**
 * Convert PEM-formatted private key to ArrayBuffer for Web Crypto
 */
function pemToArrayBuffer(pem) {
  const binaryString = atob(pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Create JWT for Google Service Account
 */
async function createJwt(serviceAccount, impersonateEmail) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: GMAIL_SCOPES.join(' '),
    sub: impersonateEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp
  };

  const headerEncoded = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadEncoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Sign with private key
  const privateKeyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureEncoded = btoa(String.fromCharCode.apply(null, signatureArray)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signatureInput}.${signatureEncoded}`;
}

/**
 * Get access token from JWT
 */
async function getAccessToken() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

  if (!serviceAccountJson || !impersonateEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_IMPERSONATE_USER_EMAIL environment variable');
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

/**
 * Make authenticated Gmail API request
 * 
 * @param {string} endpoint - API endpoint (e.g., /gmail/v1/users/me/threads)
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} body - Request body (for POST/PATCH/PUT)
 * @param {object} queryParams - URL query parameters
 * @returns {object} Parsed response JSON
 */
export async function gmailFetch(endpoint, method = 'GET', body = null, queryParams = null) {
  let retries = 0;
  const maxRetries = 3;
  const backoffMs = 1000;

  while (retries < maxRetries) {
    try {
      const accessToken = await getAccessToken();
      
      let url = `https://www.googleapis.com${endpoint}`;
      
      // Add query parameters
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

      // Handle rate limiting and server errors with exponential backoff
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Max retries exceeded. Last status: ${response.status}`);
        }
        const waitMs = backoffMs * Math.pow(2, retries - 1);
        console.log(`[gmailFetch] Rate limited or server error (${response.status}). Retrying in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < maxRetries - 1 && (error.message.includes('Rate limited') || error.message.includes('server error'))) {
        retries++;
        const waitMs = backoffMs * Math.pow(2, retries - 1);
        console.log(`[gmailFetch] Retry ${retries}/${maxRetries} after ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}