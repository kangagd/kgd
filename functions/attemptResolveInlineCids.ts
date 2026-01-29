/**
 * Deferred CID Resolution - Idempotent attempt to resolve unresolved inline images
 * Safe to call multiple times; no side effects if nothing changes
 * 
 * Respects backoff: skip if last attempt was < 10 minutes ago
 * Sets cid_state to "resolved" or "failed" upon completion
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { normalizeCid, buildCidMapFromAttachments, determineCidState, extractCidsFromHtml } from './shared/cidHelpers.js';

const CID_RESOLUTION_BACKOFF_MS = 10 * 60 * 1000; // 10 minutes

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

async function createJwt(serviceAccount, impersonateEmail) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
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

/**
 * Attempt to resolve unresolved CIDs for a message
 * Idempotent: safe to call multiple times
 * 
 * @param {Object} message - EmailMessage record
 * @param {Object} base44 - SDK client
 * @returns {Promise<{resolved: boolean, newState: string}>}
 */
export async function attemptResolveInlineCids(message, base44) {
  try {
    // Skip if already resolved or failed
    if (message.cid_state === 'resolved' || message.cid_state === 'failed') {
      return { resolved: false, newState: message.cid_state, reason: 'already_terminal' };
    }

    // Backoff: skip if last attempt was recent
    if (message.cid_last_attempt_at) {
      const lastAttempt = new Date(message.cid_last_attempt_at).getTime();
      const now = Date.now();
      if (now - lastAttempt < CID_RESOLUTION_BACKOFF_MS) {
        return { resolved: false, newState: message.cid_state, reason: 'backoff_active' };
      }
    }

    // Extract detected CIDs from HTML
    const detectedCids = extractCidsFromHtml(message.body_html);
    if (detectedCids.length === 0) {
      // No CIDs to resolve; mark as resolved
      await base44.asServiceRole.entities.EmailMessage.update(message.id, {
        cid_state: 'resolved',
        cid_last_attempt_at: new Date().toISOString()
      });
      return { resolved: true, newState: 'resolved', reason: 'no_cids_detected' };
    }

    // Attempt to fetch message metadata from Gmail
    const accessToken = await getAccessToken();
    const gmailResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${message.gmail_message_id}?format=metadata&metadataHeaders=Content-ID`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!gmailResponse.ok) {
      // Gmail API error: mark as failed
      await base44.asServiceRole.entities.EmailMessage.update(message.id, {
        cid_state: 'failed',
        cid_last_attempt_at: new Date().toISOString()
      });
      return { resolved: false, newState: 'failed', reason: 'gmail_api_error' };
    }

    const gmailMsg = await gmailResponse.json();

    // Try to match attachment IDs to CIDs
    const cidMap = message.cid_map || {};
    let resolved = 0;

    if (gmailMsg.payload?.parts) {
      for (const part of gmailMsg.payload.parts) {
        if (!part.filename || !part.body?.attachmentId) continue;

        // Look for Content-ID header
        let contentId = null;
        if (part.headers) {
          for (const header of part.headers) {
            if (header.name?.toLowerCase() === 'content-id') {
              contentId = normalizeCid(header.value);
              break;
            }
          }
        }

        if (contentId && detectedCids.includes(contentId)) {
          cidMap[contentId] = {
            attachment_id: part.body.attachmentId,
            resolved_at: new Date().toISOString()
          };
          resolved++;
        }
      }
    }

    // Determine new state
    const newState = determineCidState(detectedCids, cidMap);
    const newCidMap = Object.keys(cidMap).length > 0 ? cidMap : null;

    // Update message with new CID state
    await base44.asServiceRole.entities.EmailMessage.update(message.id, {
      cid_state: newState,
      cid_map: newCidMap,
      cid_last_attempt_at: new Date().toISOString()
    });

    return { resolved: newState === 'resolved', newState, reason: `resolved_${resolved}_of_${detectedCids.length}` };
  } catch (err) {
    console.error(`[attemptResolveInlineCids] Error for ${message.gmail_message_id}:`, err.message);
    return { resolved: false, newState: 'failed', reason: err.message };
  }
}

// HTTP handler for scheduled/manual invocation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const { message_id } = bodyText ? JSON.parse(bodyText) : {};

    if (!message_id) {
      return Response.json({ error: 'Missing message_id' }, { status: 400 });
    }

    // Fetch message
    const message = await base44.asServiceRole.entities.EmailMessage.get(message_id);
    if (!message) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    // Attempt resolution
    const result = await attemptResolveInlineCids(message, base44);

    return Response.json(result);
  } catch (error) {
    console.error('[attemptResolveInlineCids] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});