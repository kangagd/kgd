/**
 * gmailGetThread - Fetch full Gmail thread and upsert messages
 * 
 * Retrieves all messages in a Gmail thread and creates/updates EmailMessage records.
 * Properly extracts and stores RFC headers for threading (Message-ID, In-Reply-To, References).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClientV2.js';

/**
 * Sanitize HTML body for storage
 * Remove script tags, event handlers, but preserve safe formatting
 */
function sanitizeBodyHtml(html) {
  if (!html) return '';
  
  // Remove script tags and content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  
  return sanitized.trim();
}

/**
 * Extract text from Gmail MIME message
 */
function getMimeText(payload, mimeType) {
  if (payload.mimeType === mimeType && payload.body?.data) {
    try {
      const decoded = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      return new TextDecoder().decode(new Uint8Array(decoded.split('').map(c => c.charCodeAt(0))));
    } catch (err) {
      console.error('[gmailGetThread] Error decoding MIME text:', err);
      return '';
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = getMimeText(part, mimeType);
      if (result) return result;
    }
  }

  return '';
}

/**
 * Extract message ID from email address format
 * e.g., "Name <email@domain.com>" -> "email@domain.com"
 */
function extractEmailAddress(addressStr) {
  if (!addressStr) return '';
  const match = addressStr.match(/<([^>]+)>/);
  return match ? match[1] : addressStr.trim();
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

    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};
    const { gmail_thread_id, thread_id } = requestBody;

    if (!gmail_thread_id) {
      return Response.json({ error: 'Missing gmail_thread_id' }, { status: 400 });
    }

    stage = 'gmail_get_thread';
    console.log('[gmailGetThread] Fetching thread:', gmail_thread_id);

    const threadData = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}`,
      'GET',
      null,
      { format: 'full' }
    );

    if (!threadData.messages || threadData.messages.length === 0) {
      return Response.json({ error: 'Thread has no messages' }, { status: 404 });
    }

    stage = 'parse_messages';
    const messages = [];

    for (const gmailMsg of threadData.messages) {
      try {
        const headers = {};
        if (gmailMsg.payload?.headers) {
          gmailMsg.payload.headers.forEach(h => {
            headers[h.name.toLowerCase()] = h.value;
          });
        }

        // Extract RFC headers for threading
        const messageId = headers['message-id'] || `<${gmailMsg.id}@gmail.com>`;
        const inReplyTo = headers['in-reply-to'] || null;
        const references = headers['references'] || null;

        // Parse recipients
        const toAddresses = headers['to'] ? headers['to'].split(',').map(e => extractEmailAddress(e.trim())) : [];
        const ccAddresses = headers['cc'] ? headers['cc'].split(',').map(e => extractEmailAddress(e.trim())) : [];
        const bccAddresses = headers['bcc'] ? headers['bcc'].split(',').map(e => extractEmailAddress(e.trim())) : [];

        // Get body
        const bodyHtml = sanitizeBodyHtml(getMimeText(gmailMsg.payload, 'text/html'));
        const bodyText = getMimeText(gmailMsg.payload, 'text/plain');

        // Parse attachments
        const attachments = [];
        if (gmailMsg.payload?.parts) {
          for (const part of gmailMsg.payload.parts) {
            if (part.filename && part.body?.attachmentId) {
              attachments.push({
                filename: part.filename,
                attachment_id: part.body.attachmentId,
                gmail_message_id: gmailMsg.id,
                mime_type: part.mimeType,
                content_id: part.headers?.find(h => h.name === 'Content-ID')?.value || null,
                is_inline: part.headers?.some(h => h.name === 'Content-Disposition' && h.value.includes('inline')) || false
              });
            }
          }
        }

        const msgDate = gmailMsg.internalDate ? new Date(parseInt(gmailMsg.internalDate)).toISOString() : new Date().toISOString();

        messages.push({
          gmail_message_id: gmailMsg.id,
          gmail_thread_id: gmail_thread_id,
          thread_id: thread_id || null,
          from_address: extractEmailAddress(headers['from'] || ''),
          from_name: headers['from'] || '',
          to_addresses: toAddresses,
          cc_addresses: ccAddresses,
          bcc_addresses: bccAddresses,
          subject: headers['subject'] || '',
          body_html: bodyHtml,
          body_text: bodyText,
          sent_at: msgDate,
          is_outbound: false, // Assume inbound unless we know otherwise
          message_id: messageId,
          in_reply_to: inReplyTo,
          references: references,
          attachments: attachments.length > 0 ? attachments : []
        });
      } catch (err) {
        console.error(`[gmailGetThread] Error parsing message ${gmailMsg.id}:`, err);
      }
    }

    stage = 'upsert_messages';

    // Only upsert if thread_id is provided (caller wants to persist)
    const upsertedMessages = [];
    if (thread_id) {
      for (const msg of messages) {
        try {
          msg.thread_id = thread_id;
          
          // Check if message exists
          const existing = await base44.asServiceRole.entities.EmailMessage.filter({
            gmail_message_id: msg.gmail_message_id
          });

          if (existing.length > 0) {
            await base44.asServiceRole.entities.EmailMessage.update(existing[0].id, msg);
            upsertedMessages.push({
              id: existing[0].id,
              action: 'updated'
            });
          } else {
            const newMsg = await base44.asServiceRole.entities.EmailMessage.create(msg);
            upsertedMessages.push({
              id: newMsg.id,
              action: 'created'
            });
          }
        } catch (err) {
          console.error(`[gmailGetThread] Error upserting message:`, err);
        }
      }
    }

    return Response.json({
      success: true,
      threadId: gmail_thread_id,
      messageCount: messages.length,
      messages: messages, // Return parsed messages even if not persisted
      upsertedCount: upsertedMessages.length
    });
  } catch (error) {
    console.error(`[gmailGetThread] Error at stage '${stage}':`, error);
    return Response.json(
      { error: error.message, stage },
      { status: 500 }
    );
  }
});