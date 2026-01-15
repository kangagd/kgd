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
      if (response.status === 404) {
        return response;
      }
      
      // Retry on 429 (rate limit) and 503 (service unavailable)
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries - 1) {
        const delay = delays[attempt];
        console.log(`[gmailGetInlineAttachmentUrl] Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Helper: safely decode base64url
function decodeBase64Url(b64url) {
  if (!b64url) throw new Error('No attachment data provided');
  
  // Convert base64url to base64
  const b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  
  try {
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new Error(`Failed to decode base64url: ${err.message}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { gmail_message_id, attachment_id } = payload;

    if (!gmail_message_id || !attachment_id) {
      return Response.json({
        success: false,
        error: 'Missing gmail_message_id or attachment_id',
      }, { status: 400 });
    }

    // Find the EmailMessage record to check if we already have a cached file_url or url
    let emailMessage = null;
    try {
      const emailMessages = await base44.asServiceRole.entities.EmailMessage.filter({
        gmail_message_id,
      });
      emailMessage = emailMessages[0] || null;
    } catch (err) {
      console.error('[gmailGetInlineAttachmentUrl] Error fetching EmailMessage:', err);
      // Non-fatal: continue without cache
    }

    // Check cache: accept file_url OR url (backwards compatibility)
    if (emailMessage && emailMessage.attachments) {
      const cachedAttachment = emailMessage.attachments.find(
        (att) => att.attachment_id === attachment_id && (att.file_url || att.url)
      );
      if (cachedAttachment) {
        const cachedUrl = cachedAttachment.file_url || cachedAttachment.url;
        return Response.json({
          success: true,
          file_url: cachedUrl,
          fromCache: true,
        });
      }
    }

    // Not cached → fetch from Gmail
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

    // Fetch attachment from Gmail API
    const gmailRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${attachment_id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!gmailRes.ok) {
      throw new Error(`Gmail API error: ${gmailRes.status}`);
    }

    const attachmentData = await gmailRes.json();
    if (!attachmentData.data) {
      throw new Error('No attachment data in Gmail response');
    }

    // Convert base64 to binary
    const binaryStr = atob(attachmentData.data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload using Base44 UploadFile integration
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({
      file: bytes,
    });

    if (!uploadRes.file_url) {
      throw new Error('Failed to upload attachment');
    }

    const fileUrl = uploadRes.file_url;

    // Cache the file_url in EmailMessage.attachments
    if (emailMessage && emailMessage.attachments) {
      const updated = emailMessage.attachments.map((att) => {
        if (att.attachment_id === attachment_id) {
          return { ...att, file_url: fileUrl };
        }
        return att;
      });

      try {
        await base44.asServiceRole.entities.EmailMessage.update(emailMessage.id, {
          attachments: updated,
        });
      } catch (err) {
        console.error('[gmailGetInlineAttachmentUrl] Error updating EmailMessage cache:', err);
        // Non-fatal; we got the URL, just didn't cache it
      }
    }

    return Response.json({
      success: true,
      file_url: fileUrl,
    });
  } catch (error) {
    console.error('[gmailGetInlineAttachmentUrl] Error:', error);
    // Extract error message safely
    let errorMsg = 'Failed to fetch inline attachment';
    if (error?.message && typeof error.message === 'string') {
      errorMsg = error.message;
    } else if (error?.statusText) {
      errorMsg = `API Error: ${error.statusText}`;
    } else if (typeof error === 'string') {
      errorMsg = error;
    }
    return Response.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
});