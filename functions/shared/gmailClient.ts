import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createServiceAccountClient } from './sdk.js';

let cachedAccessToken = null;
let tokenExpiryTime = null;

async function getServiceAccountAccessToken() {
  const now = Date.now();
  
  // Return cached token if still valid (5min buffer)
  if (cachedAccessToken && tokenExpiryTime && now < tokenExpiryTime - 300000) {
    return cachedAccessToken;
  }

  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');
  
  if (!impersonateEmail) {
    throw new Error('GOOGLE_IMPERSONATE_USER_EMAIL not configured');
  }

  // Create JWT assertion
  const now_seconds = Math.floor(Date.now() / 1000);
  const expiry = now_seconds + 3600; // 1 hour
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iss: serviceAccount.client_email,
    sub: impersonateEmail,
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now_seconds
  };

  const headerEncoded = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadEncoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Sign JWT with service account private key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = `${signatureInput}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokens = await tokenResponse.json();
  cachedAccessToken = tokens.access_token;
  tokenExpiryTime = now + tokens.expires_in * 1000;

  return cachedAccessToken;
}

export async function gmailFetch(endpoint, method = 'GET', body = null, params = null) {
  const accessToken = await getServiceAccountAccessToken();
  
  let url = `https://gmail.googleapis.com${endpoint}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
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
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}