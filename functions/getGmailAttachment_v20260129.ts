import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { decodeBase64UrlToBytes } from './shared/base64UrlDecoder.js';

console.log("[DEPLOY_SENTINEL] getGmailAttachment_v20260129 v=2026-02-05");

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

    // Get Gmail access token from app connector
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");

    // Fetch the attachment from Gmail API
    const attResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${attachment_id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!attResponse.ok) {
      throw new Error(`Gmail API error: ${attResponse.status}`);
    }

    const attData = await attResponse.json();
    
    if (!attData?.data) {
      return Response.json({ error: 'No attachment data returned' }, { status: 500 });
    }

    // Decode Base64URL with proper padding handling
    const bytes = decodeBase64UrlToBytes(attData.data);

    // Upload to Base44 file storage
    const file = new File([bytes], filename || 'attachment', { type: mime_type || 'application/octet-stream' });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (!uploadResult?.file_url) {
      return Response.json({ error: 'Failed to upload attachment' }, { status: 500 });
    }

    return Response.json({ 
      url: uploadResult.file_url,
      filename: filename,
      mime_type: mime_type,
      version: '2026-02-05'
    });

  } catch (error) {
    console.error('Get attachment error:', error);
    return Response.json({ error: error.message, version: '2026-02-05' }, { status: 500 });
  }
});