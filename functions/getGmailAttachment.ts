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
  const runId = crypto.randomUUID().slice(0, 8);
  
  try {
    const base44 = createClientFromRequest(req);
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { gmail_message_id, attachment_id, cid, filename, mime_type } = body;

    // Validate inputs
    if (!gmail_message_id) {
      console.log(`[${runId}] Missing gmail_message_id`);
      return Response.json({ error: 'Missing required parameter: gmail_message_id' }, { status: 400 });
    }
    
    if (!attachment_id && !cid) {
      console.log(`[${runId}] Missing both attachment_id and cid`);
      return Response.json({ error: 'Missing required parameter: attachment_id or cid' }, { status: 400 });
    }

    // Check cache first (if attachment_id is available)
    if (attachment_id) {
      const cacheKey = `${gmail_message_id}:${attachment_id}`;
      
      // Rate limiting
      const rateCheck = checkRateLimit(cacheKey);
      if (!rateCheck.allowed) {
        console.log(`[${runId}] Rate limit hit for ${cacheKey}`);
        return Response.json({ 
          error: 'Too many requests for this attachment', 
          retry_after_ms: rateCheck.retryAfter 
        }, { status: 429 });
      }
      
      // Check cache
      const cached = await base44.asServiceRole.entities.EmailAttachmentCache.filter({ 
        gmail_message_id, 
        attachment_id 
      });
      
      if (cached.length > 0 && cached[0].url) {
        console.log(`[${runId}] Cache hit for ${cacheKey}`);
        return Response.json({ 
          url: cached[0].url,
          filename: cached[0].filename || filename,
          mime_type: cached[0].mime_type || mime_type,
          cached: true
        });
      }
    }

    // Get Gmail client with service account auth
    const gmailClient = await getGmailClient(base44);
    if (!gmailClient) {
      console.error(`[${runId}] Failed to get Gmail client - check GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_IMPERSONATE_USER_EMAIL`);
      return Response.json({ 
        error: 'Gmail service account not configured' 
      }, { status: 500 });
    }

    // If only CID provided, need to fetch message and find attachmentId
    let finalAttachmentId = attachment_id;
    if (!finalAttachmentId && cid) {
      console.log(`[${runId}] Fetching message to resolve CID: ${cid}`);
      
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}?format=full`,
        { headers: { 'Authorization': `Bearer ${gmailClient.accessToken}` } }
      );
      
      if (!msgResponse.ok) {
        const status = msgResponse.status;
        console.error(`[${runId}] Gmail message fetch failed: ${status}`);
        
        if (status === 404) {
          return Response.json({ error: 'Gmail message not found' }, { status: 404 });
        } else if (status === 403) {
          return Response.json({ error: 'Permission denied to access Gmail message' }, { status: 403 });
        }
        
        return Response.json({ error: 'Failed to fetch Gmail message' }, { status: status >= 500 ? 500 : 400 });
      }
      
      const msgData = await msgResponse.json();
      const normalizedCid = cid.replace(/^<|>$/g, '').toLowerCase();
      
      // Walk parts to find matching CID
      const findPartByCid = (parts) => {
        if (!parts) return null;
        
        for (const part of parts) {
          // Check headers for Content-ID
          const cidHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
          if (cidHeader) {
            const partCid = cidHeader.value.replace(/^<|>$/g, '').toLowerCase();
            if (partCid === normalizedCid) {
              return part;
            }
          }
          
          // Recurse into nested parts
          if (part.parts) {
            const found = findPartByCid(part.parts);
            if (found) return found;
          }
        }
        return null;
      };
      
      const part = findPartByCid(msgData.payload?.parts || [msgData.payload]);
      
      if (!part) {
        console.log(`[${runId}] CID not found in message: ${cid}`);
        return Response.json({ error: 'Inline image not found in message', cid }, { status: 404 });
      }
      
      if (!part.body?.attachmentId) {
        console.log(`[${runId}] Inline image has no attachmentId (embedded): ${cid}`);
        return Response.json({ 
          error: 'inline-image-has-no-attachmentId', 
          cid,
          details: 'Image is embedded in message body, not as separate attachment'
        }, { status: 409 });
      }
      
      finalAttachmentId = part.body.attachmentId;
      console.log(`[${runId}] Resolved CID ${cid} -> attachmentId ${finalAttachmentId}`);
    }

    // Fetch the attachment from Gmail
    console.log(`[${runId}] Fetching attachment ${finalAttachmentId} from message ${gmail_message_id}`);
    const attResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${finalAttachmentId}`,
      { headers: { 'Authorization': `Bearer ${gmailClient.accessToken}` } }
    );

    if (!attResponse.ok) {
      const status = attResponse.status;
      const errorText = await attResponse.text();
      console.error(`[${runId}] Gmail attachment fetch failed: ${status} - ${errorText}`);
      
      if (status === 404) {
        return Response.json({ 
          error: 'Attachment not found in Gmail', 
          gmail_message_id, 
          attachment_id: finalAttachmentId 
        }, { status: 404 });
      } else if (status === 403) {
        return Response.json({ error: 'Permission denied to access attachment' }, { status: 403 });
      }
      
      return Response.json({ 
        error: 'Failed to fetch attachment from Gmail',
        status 
      }, { status: status >= 500 ? 500 : 400 });
    }

    const attData = await attResponse.json();
    
    if (!attData.data) {
      console.error(`[${runId}] No attachment data in Gmail response`);
      return Response.json({ error: 'No attachment data returned from Gmail' }, { status: 500 });
    }

    // Decode Base64URL with proper padding handling
    const bytes = decodeBase64UrlToBytes(attData.data);
    console.log(`[${runId}] Decoded ${bytes.length} bytes`);

    // Upload to Base44 file storage (expects Blob/File)
    const blob = new Blob([bytes], { type: mime_type || 'application/octet-stream' });
    const file = new File([blob], filename || 'attachment', { type: mime_type || 'application/octet-stream' });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (!uploadResult?.file_url) {
      console.error(`[${runId}] Upload to Base44 storage failed`);
      return Response.json({ error: 'Failed to upload attachment to storage' }, { status: 500 });
    }

    console.log(`[${runId}] Successfully uploaded attachment: ${uploadResult.file_url}`);
    
    // Cache the result
    if (finalAttachmentId) {
      try {
        await base44.asServiceRole.entities.EmailAttachmentCache.create({
          gmail_message_id,
          attachment_id: finalAttachmentId,
          url: uploadResult.file_url,
          filename: filename,
          mime_type: mime_type,
          size_bytes: bytes.length
        });
        console.log(`[${runId}] Cached attachment`);
      } catch (cacheErr) {
        console.warn(`[${runId}] Failed to cache attachment:`, cacheErr.message);
      }
    }

    return Response.json({ 
      url: uploadResult.file_url,
      filename: filename,
      mime_type: mime_type
    });

  } catch (error) {
    console.error(`[${runId}] Unexpected error:`, error);
    return Response.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
});