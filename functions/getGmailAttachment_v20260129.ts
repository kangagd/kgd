import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';
import { decodeBase64UrlToBytes } from './shared/base64UrlDecoder.js';

console.log("[DEPLOY_SENTINEL] getGmailAttachment_v20260129 v=2026-01-29");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { gmail_message_id, attachment_id, filename, mime_type } = body;

    if (!gmail_message_id || !attachment_id) {
      return Response.json({ error: 'Missing gmail_message_id or attachment_id' }, { status: 400 });
    }

    // Fetch the attachment from Gmail using shared client
    const attData = await gmailFetch(
      `/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${attachment_id}`,
      'GET'
    );
    
    if (!attData?.data) {
      return Response.json({ success: false, error: 'No attachment data returned' }, { status: 200 });
    }

    // Decode Base64URL with proper padding handling
    const bytes = decodeBase64UrlToBytes(attData.data);

    // Upload to Base44 file storage
    const file = new File([bytes], filename || 'attachment', { type: mime_type || 'application/octet-stream' });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (!uploadResult?.file_url) {
      return Response.json({ success: false, error: 'Failed to upload attachment' }, { status: 200 });
    }

    return Response.json({ 
      success: true,
      url: uploadResult.file_url,
      filename: filename,
      mime_type: mime_type,
      version: '2026-01-29'
    });

  } catch (error) {
    console.error('Get attachment error:', error);
    return Response.json({ success: false, error: error.message, version: '2026-01-29' }, { status: 200 });
  }
});