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

    // Find the EmailMessage record to check if we already have a cached file_url
    let emailMessages = [];
    try {
      emailMessages = await base44.asServiceRole.entities.EmailMessage.filter({
        gmail_message_id,
      });
    } catch (err) {
      console.error('[gmailGetInlineAttachmentUrl] Error fetching EmailMessage:', err);
    }

    const emailMessage = emailMessages[0];
    if (emailMessage && emailMessage.attachments) {
      const cachedAttachment = emailMessage.attachments.find(
        (att) => att.attachment_id === attachment_id && att.file_url
      );
      if (cachedAttachment) {
        return Response.json({
          success: true,
          file_url: cachedAttachment.file_url,
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
    // Extract error message safely (handle non-Error objects)
    const errorMsg = error?.message || String(error) || 'Unknown error';
    return Response.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
});