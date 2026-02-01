import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { decodeBase64UrlToBytes } from './shared/base64UrlDecoder.ts';
import { getGmailClient } from './shared/gmailClient.ts';

// Rate limiting: track requests per attachment
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 3;

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, windowStart: now };
  
  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    record.count = 0;
    record.windowStart = now;
  }
  
  record.count++;
  rateLimitMap.set(key, record);
  
  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = RATE_LIMIT_WINDOW - (now - record.windowStart);
    return { allowed: false, retryAfter };
  }
  
  return { allowed: true };
}

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

    // First try current user, then find any user with Gmail connected (admin account)
    let user = null;
    
    // Try current user first
    const currentUsers = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (currentUsers.length > 0 && currentUsers[0].gmail_access_token) {
      user = currentUsers[0];
    }
    
    // If current user doesn't have Gmail, find admin with Gmail connected
    if (!user) {
      const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const adminUser of adminUsers) {
        if (adminUser.gmail_access_token) {
          user = adminUser;
          break;
        }
      }
    }
    
    if (!user || !user.gmail_access_token) {
      return Response.json({ error: 'No Gmail account connected. Please connect Gmail in settings.' }, { status: 400 });
    }

    const accessToken = await refreshTokenIfNeeded(user, base44);

    // Fetch the attachment from Gmail
    const attResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${attachment_id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!attResponse.ok) {
      const error = await attResponse.text();
      console.error('Failed to fetch attachment:', error);
      return Response.json({ error: 'Failed to fetch attachment from Gmail' }, { status: 500 });
    }

    const attData = await attResponse.json();
    
    if (!attData.data) {
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
      mime_type: mime_type
    });

  } catch (error) {
    console.error('Get attachment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});