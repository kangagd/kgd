/**
 * gmailModifyThread - Modify thread properties
 * 
 * Actions:
 *   - mark_read / mark_unread
 *   - archive / unarchive
 *   - add_label / remove_label
 * 
 * Only admin/manager can perform thread modifications.
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

Deno.serve(async (req) => {
  let stage = 'init';
  try {
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json(
        { error: 'Forbidden: Only admin/manager can modify threads' },
        { status: 403 }
      );
    }

    stage = 'parse_request';
    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};

    const { gmail_thread_id, action, label_id = null } = requestBody;

    if (!gmail_thread_id || !action) {
      return Response.json(
        { error: 'Missing gmail_thread_id or action' },
        { status: 400 }
      );
    }

    stage = 'apply_action';
    const validActions = ['mark_read', 'mark_unread', 'archive', 'unarchive', 'add_label', 'remove_label'];

    if (!validActions.includes(action)) {
      return Response.json(
        { error: `Invalid action. Valid: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let modifyPayload = {};

    switch (action) {
      case 'mark_read':
        modifyPayload = { removeLabelIds: ['UNREAD'] };
        break;
      case 'mark_unread':
        modifyPayload = { addLabelIds: ['UNREAD'] };
        break;
      case 'archive':
        modifyPayload = { removeLabelIds: ['INBOX'] };
        break;
      case 'unarchive':
        modifyPayload = { addLabelIds: ['INBOX'] };
        break;
      case 'add_label':
        if (!label_id) {
          return Response.json({ error: 'label_id required for add_label' }, { status: 400 });
        }
        modifyPayload = { addLabelIds: [label_id] };
        break;
      case 'remove_label':
        if (!label_id) {
          return Response.json({ error: 'label_id required for remove_label' }, { status: 400 });
        }
        modifyPayload = { removeLabelIds: [label_id] };
        break;
    }

    stage = 'gmail_modify';
    console.log('[gmailModifyThread] Modifying thread:', gmail_thread_id, 'action:', action);

    const result = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}/modify`,
      'POST',
      modifyPayload
    );

    return Response.json({
      success: true,
      action,
      threadId: gmail_thread_id,
      result
    });
  } catch (error) {
    console.error(`[gmailModifyThread] Error at stage '${stage}':`, error);
    return Response.json(
      { error: error.message, stage },
      { status: 500 }
    );
  }
});