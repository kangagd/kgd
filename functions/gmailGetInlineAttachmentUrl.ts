import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetch an inline attachment from Gmail and upload it, with caching
 *
 * Input:
 *   - gmail_message_id: Gmail message ID
 *   - attachment_id: Gmail attachment ID
 *
 * Output:
 *   - { success: true, file_url } on success
 *   - { success: false, error } on failure
 */

// Helper: retry Gmail fetch on 429/503 with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  const delays = [200, 600, 1400];
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 404 is not retryable
      if (response.status === 404) return response;

      // Retry on 429 / 503
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries - 1) {
        const delay = delays[attempt];
        console.log(`[gmailGetInlineAttachmentUrl] Retry in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// Helper: safely decode base64url with padding
function decodeBase64Url(b64url) {
  if (!b64url) throw new Error('No attachment data provided');

  let b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';

  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
}



// Helper: stringify errors safely (avoid "[object Object]")
function safeErr(error) {
  if (typeof error === 'string') return error;
  if (error?.message && typeof error.message === 'string') return error.message;
  try {
    return JSON.stringify(error?.data || error, null, 2);
  } catch {
    return 'Unknown error';
  }
}

Deno.serve(async (req) => {
  let phase = 'start';
  try {
    const base44 = createClientFromRequest(req);

    phase = 'auth';
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized', phase }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { gmail_message_id, attachment_id } = payload;

    if (!gmail_message_id || !attachment_id) {
      return Response.json(
        { success: false, error: 'Missing gmail_message_id or attachment_id', phase: 'validate' },
        { status: 400 }
      );
    }

    // Cache lookup: EmailMessage by gmail_message_id
    phase = 'cache_lookup';
    let emailMessage = null;
    try {
      const emailMessages = await base44.asServiceRole.entities.EmailMessage.filter({ gmail_message_id });
      emailMessage = emailMessages?.[0] || null;
    } catch (err) {
      console.error('[gmailGetInlineAttachmentUrl] cache_lookup failed:', err);
    }

    // Cache hit: accept file_url OR legacy url
    if (emailMessage?.attachments?.length) {
      const cachedAttachment = emailMessage.attachments.find(
        (att) => att?.attachment_id === attachment_id && (att.file_url || att.url)
      );
      if (cachedAttachment) {
        return Response.json(
          { success: true, file_url: cachedAttachment.file_url || cachedAttachment.url, fromCache: true, phase },
          { status: 200 }
        );
      }
    }

    // Get Gmail access token from app connector
    phase = 'get_token';
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");

    // Fetch attachment from Gmail
    phase = 'gmail_fetch';
    const gmailUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${attachment_id}`;
    const gmailRes = await fetchWithRetry(gmailUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (gmailRes.status === 404) {
      return Response.json(
        { success: false, error: 'Attachment not found in Gmail', status: 404, phase },
        { status: 404 }
      );
    }
    if (gmailRes.status === 429) {
      return Response.json(
        { success: false, error: 'Gmail rate limited', status: 429, phase },
        { status: 503 }
      );
    }
    if (gmailRes.status === 503) {
      return Response.json(
        { success: false, error: 'Gmail service unavailable', status: 503, phase },
        { status: 503 }
      );
    }
    if (!gmailRes.ok) {
      const txt = await gmailRes.text().catch(() => '');
      return Response.json(
        { success: false, error: `Gmail API error ${gmailRes.status}: ${txt}`, status: gmailRes.status, phase },
        { status: 502 }
      );
    }

    const attachmentData = await gmailRes.json();
    if (!attachmentData?.data) {
      return Response.json(
        { success: false, error: 'No attachment data in Gmail response', phase: 'gmail_parse' },
        { status: 502 }
      );
    }

    // Decode
    phase = 'decode';
    const bytes = decodeBase64Url(attachmentData.data);

    // Upload using File object (UploadFile requires File, not Blob)
    phase = 'upload';
    
    // Defensive check for File API
    if (typeof File === 'undefined') {
      throw new Error('File API not available in this runtime');
    }

    const attMeta = emailMessage?.attachments?.find((a) => a?.attachment_id === attachment_id) || null;
    const mimeType = attMeta?.mime_type || 'application/octet-stream';
    const filename = attMeta?.filename || `inline-${attachment_id}.bin`;

    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (!uploadRes?.file_url) {
      return Response.json({ success: false, error: 'Failed to upload attachment', phase }, { status: 500 });
    }

    const fileUrl = uploadRes.file_url;

    // Cache write: never overwrite non-empty
    phase = 'cache_write';
    if (emailMessage?.attachments?.length) {
      const updated = emailMessage.attachments.map((att) => {
        if (att?.attachment_id !== attachment_id) return att;

        const existing = att.file_url || att.url;
        if (existing) return att; // never overwrite

        return { ...att, file_url: fileUrl, url: fileUrl }; // keep legacy url for backwards compat
      });

      try {
        await base44.asServiceRole.entities.EmailMessage.update(emailMessage.id, { attachments: updated });
      } catch (err) {
        console.error('[gmailGetInlineAttachmentUrl] cache_write failed:', err);
      }
    }

    return Response.json({ success: true, file_url: fileUrl, phase }, { status: 200 });
  } catch (error) {
    console.error('[gmailGetInlineAttachmentUrl] Error in phase', phase, ':', error);
    return Response.json({ success: false, error: safeErr(error), phase }, { status: 500 });
  }
});