import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

function normalizeText(text) {
  if (text == null) return text;
  let normalized = String(text);
  const entityMap = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  for (const [entity, char] of Object.entries(entityMap)) {
    normalized = normalized.replace(new RegExp(entity, 'g'), char);
  }
  normalized = normalized.replace(/\u200B/g, '');
  normalized = normalized.replace(/\u00A0/g, ' ');
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized;
}

const decodeUtf8 = (base64urlData) => {
  try {
    const base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    console.error('UTF-8 decode error:', err);
    return '';
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};
    const { gmailThreadId, linkTarget } = requestBody;

    if (!gmailThreadId) {
      return Response.json({ error: 'gmailThreadId is required' }, { status: 400 });
    }

    console.log('[importGmailThread] Importing thread:', gmailThreadId);

    // Step 1: Fetch thread metadata to get message IDs
    const threadDetail = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmailThreadId}`,
      'GET',
      null,
      { format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'] }
    );

    if (!threadDetail.messages || threadDetail.messages.length === 0) {
      return Response.json({ error: 'Thread has no messages' }, { status: 400 });
    }

    // Step 2: Upsert EmailThread
    const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
    const lastHeaders = {};
    if (lastMsg.payload?.headers) {
      lastMsg.payload.headers.forEach(h => {
        lastHeaders[h.name.toLowerCase()] = h.value;
      });
    }

    const subject = lastHeaders['subject'] || '(no subject)';
    const fromAddress = lastHeaders['from'] || '';
    const toAddresses = lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [];
    const lastMsgDate = lastMsg.internalDate ? new Date(parseInt(lastMsg.internalDate)).toISOString() : new Date().toISOString();

    let snippet = threadDetail.snippet || '';
    if (snippet.length > 200) {
      snippet = snippet.substring(0, 200) + '...';
    }

    // Check if thread already exists
    const existing = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id: gmailThreadId
    });

    let threadId;
    let createdThread = false;

    const threadData = {
      subject,
      gmail_thread_id: gmailThreadId,
      from_address: fromAddress,
      to_addresses: toAddresses,
      last_message_date: lastMsgDate,
      last_message_snippet: snippet,
      message_count: threadDetail.messages.length,
      is_read: false,
      status: 'Open',
      priority: 'Normal',
      last_activity_at: lastMsgDate
    };

    if (existing.length > 0) {
      threadId = existing[0].id;
      // Update only if fields are missing
      const updateData = { ...threadData };
      if (existing[0].subject && !updateData.subject) {
        delete updateData.subject;
      }
      await base44.asServiceRole.entities.EmailThread.update(threadId, updateData);
    } else {
      const newThread = await base44.asServiceRole.entities.EmailThread.create(threadData);
      threadId = newThread.id;
      createdThread = true;
    }

    // Step 3: Import messages
    let importedMessageCount = 0;
    let skippedMessageCount = 0;

    for (let i = 0; i < threadDetail.messages.length; i++) {
      const msgId = threadDetail.messages[i].id;
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Check if message already exists
        const existingMsg = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: msgId
        });
        if (existingMsg.length > 0) {
          skippedMessageCount++;
          continue;
        }

        // Fetch full message
        const detail = await gmailFetch(`/gmail/v1/users/me/messages/${msgId}`, 'GET');

        if (!detail?.payload?.headers) {
          console.error(`Invalid message format for ${msgId}`);
          skippedMessageCount++;
          continue;
        }

        const headers = detail.payload.headers;
        const fromAddressValue = headers.find(h => h.name === 'From')?.value || '';
        
        // Skip Wix CRM emails
        if (fromAddressValue.includes('no-reply@crm.wix.com')) {
          skippedMessageCount++;
          continue;
        }

        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const messageId = headers.find(h => h.name === 'Message-ID')?.value;
        const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value;

        if (!date) {
          console.error(`Missing date for message ${msgId}`);
          skippedMessageCount++;
          continue;
        }

        // Parse body and attachments
        let bodyHtml = '';
        let bodyText = detail.snippet || '';
        const attachments = [];

        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            try {
              if (part.mimeType === 'text/html' && part.body?.data) {
                bodyHtml = decodeUtf8(part.body.data);
              } else if (part.mimeType === 'text/plain' && part.body?.data && !bodyHtml) {
                bodyText = decodeUtf8(part.body.data);
              }

              if (part.filename && part.filename.length > 0) {
                const attachmentId = part.body?.attachmentId;
                if (attachmentId) {
                  const contentIdHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
                  const contentDisposition = part.headers?.find(h => h.name.toLowerCase() === 'content-disposition');
                  const contentId = contentIdHeader?.value?.replace(/[<>]/g, '');
                  const isInline = contentDisposition?.value?.toLowerCase().includes('inline') || !!contentId;

                  attachments.push({
                    filename: part.filename,
                    mime_type: part.mimeType,
                    size: parseInt(part.body.size) || 0,
                    attachment_id: attachmentId,
                    gmail_message_id: msgId,
                    content_id: contentId || null,
                    is_inline: isInline
                  });
                }
              }

              if (part.parts) {
                processParts(part.parts);
              }
            } catch (err) {
              console.error('Error processing part:', err);
            }
          }
        };

        if (detail.payload.body?.data && !bodyHtml && !bodyText) {
          bodyText = decodeUtf8(detail.payload.body.data);
        }
        if (detail.payload.parts) {
          processParts(detail.payload.parts);
        }

        const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
        const isOutbound = fromAddressValue.toLowerCase() === impersonateEmail.toLowerCase() ||
          detail.labelIds?.includes('SENT');

        const toAddresses = to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [];

        const messageData = {
          thread_id: threadId,
          gmail_message_id: msgId,
          gmail_thread_id: gmailThreadId,
          from_address: parseEmailAddress(from) || 'unknown@unknown.com',
          to_addresses: toAddresses.length > 0 ? toAddresses : [parseEmailAddress(from)],
          sent_at: new Date(date).toISOString(),
          subject: normalizeText(subject),
          body_html: normalizeText(bodyHtml),
          body_text: normalizeText(bodyText),
          message_id: messageId || msgId,
          is_outbound: isOutbound,
          attachments: attachments.length > 0 ? attachments : undefined
        };

        if (inReplyTo) {
          messageData.in_reply_to = inReplyTo;
        }

        await base44.asServiceRole.entities.EmailMessage.create(messageData);
        importedMessageCount++;
      } catch (msgErr) {
        console.error(`[importGmailThread] Error processing message ${msgId}:`, msgErr);
        skippedMessageCount++;
      }
    }

    // Step 4: Apply linking if provided
    let linked = false;
    if (linkTarget && linkTarget.linkedEntityType && linkTarget.linkedEntityId) {
      try {
        await base44.asServiceRole.entities.EmailThread.update(threadId, {
          linkedEntityType: linkTarget.linkedEntityType,
          linkedEntityId: linkTarget.linkedEntityId,
          linkedEntityNumber: linkTarget.linkedEntityNumber,
          linkedEntityTitle: linkTarget.linkedEntityTitle,
          linkSource: 'manual',
          linkCreatedByUserId: user.id,
          linkCreatedAt: new Date().toISOString()
        });
        linked = true;
        console.log(`[importGmailThread] Linked thread ${threadId} to ${linkTarget.linkedEntityType} ${linkTarget.linkedEntityId}`);
      } catch (linkErr) {
        console.error('[importGmailThread] Linking error:', linkErr);
      }
    }

    return Response.json({
      success: true,
      threadId,
      createdThread,
      importedMessageCount,
      skippedMessageCount,
      linked
    });
  } catch (error) {
    console.error('[importGmailThread] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});