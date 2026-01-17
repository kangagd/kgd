import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Decode Base64URL to Uint8Array with proper padding handling
function decodeBase64UrlToBytes(base64Url) {
  if (!base64Url) {
    throw new Error('Empty Base64URL string');
  }

  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  
  const padLength = base64.length % 4;
  if (padLength > 0) {
    base64 += '='.repeat(4 - padLength);
  }

  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Base64URL decoding failed: ${error.message}`);
  }
}

async function refreshTokenIfNeeded(user, base44) {
  const expiry = user.gmail_token_expiry ? new Date(user.gmail_token_expiry) : new Date(0);
  const now = new Date();
  
  if (expiry - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
    if (!user.gmail_refresh_token) {
      throw new Error('Gmail refresh token not available');
    }
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: user.gmail_refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      })
    });
    
    const tokens = await tokenResponse.json();
    
    if (tokens.error) {
      throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
    }
    
    await base44.asServiceRole.entities.User.update(user.id, {
      gmail_access_token: tokens.access_token,
      gmail_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.gmail_access_token;
}

// Recursively extract attachments and inline images from message payload
function extractAttachmentsFromPayload(payload, gmailMessageId) {
  const attachments = [];
  
  function traverseParts(parts) {
    if (!Array.isArray(parts)) return;
    
    for (const part of parts) {
      const mimeType = part.mimeType || '';
      const filename = part.filename || '';
      const contentId = part.headers?.find(h => h.name === 'Content-ID')?.value;
      
      // Has attachment (filename present)
      if (filename) {
        attachments.push({
          filename: filename,
          mime_type: mimeType,
          attachment_id: part.body?.attachmentId,
          gmail_message_id: gmailMessageId,
          size: part.body?.size || 0,
          is_inline: false,
          content_id: null
        });
      }
      
      // Has inline image (image mimetype + Content-ID)
      if (mimeType.startsWith('image/') && contentId) {
        attachments.push({
          filename: filename || `image_${contentId}`,
          mime_type: mimeType,
          attachment_id: part.body?.attachmentId,
          gmail_message_id: gmailMessageId,
          size: part.body?.size || 0,
          is_inline: true,
          content_id: contentId
        });
      }
      
      // Recurse into nested parts
      if (part.parts) {
        traverseParts(part.parts);
      }
    }
  }
  
  if (payload.parts) {
    traverseParts(payload.parts);
  }
  
  return attachments;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { limit = 20, threadId } = body;

    // Find Gmail user
    let gmailUser = null;
    const allUsers = await base44.asServiceRole.entities.User.list();
    gmailUser = allUsers.find(u => u.gmail_access_token && u.gmail_refresh_token);
    
    if (!gmailUser) {
      return Response.json({ error: 'No Gmail account connected' }, { status: 401 });
    }

    const accessToken = await refreshTokenIfNeeded(gmailUser, base44);

    // Query messages missing attachments
    let query = { $or: [{ has_attachments: false }, { attachments: { $size: 0 } }] };
    if (threadId) {
      query.thread_id = threadId;
    }

    const messagesToRepair = await base44.asServiceRole.entities.EmailMessage.filter(query, null, limit);

    let scannedCount = 0;
    let repairedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const message of messagesToRepair) {
      scannedCount++;

      if (!message.gmail_message_id) {
        skippedCount++;
        console.log(`Skipping message ${message.id}: no gmail_message_id`);
        continue;
      }

      try {
        // Fetch full Gmail message
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.gmail_message_id}?format=full`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) {
          errors.push(`Failed to fetch Gmail message ${message.gmail_message_id}`);
          continue;
        }

        const fullMessage = await msgResponse.json();
        const payload = fullMessage.payload || {};

        // Extract attachments from payload
        const extractedAttachments = extractAttachmentsFromPayload(payload, message.gmail_message_id);

        if (extractedAttachments.length === 0) {
          skippedCount++;
          console.log(`Message ${message.id} has no attachments to repair`);
          continue;
        }

        // Filter out duplicates (if already in message.attachments)
        const existingAttIds = new Set((message.attachments || []).map(a => a.attachment_id));
        const newAttachments = extractedAttachments.filter(a => !existingAttIds.has(a.attachment_id));

        if (newAttachments.length === 0) {
          skippedCount++;
          console.log(`Message ${message.id} has no new attachments to save`);
          continue;
        }

        // Update message with extracted attachments
        const updatedAttachments = [...(message.attachments || []), ...newAttachments];
        
        await base44.asServiceRole.entities.EmailMessage.update(message.id, {
          attachments: updatedAttachments
        });

        repairedCount++;
        console.log(`Repaired message ${message.id}: added ${newAttachments.length} attachments`);

      } catch (err) {
        errors.push(`Error processing message ${message.id}: ${err.message}`);
        console.error(`Error repairing message ${message.id}:`, err);
      }
    }

    return Response.json({
      scanned_count: scannedCount,
      repaired_count: repairedCount,
      skipped_count: skippedCount,
      errors: errors
    });

  } catch (error) {
    console.error('repairMissingEmailAttachments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});