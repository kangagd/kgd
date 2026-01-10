import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

/**
 * Parse RFC email headers from Gmail message
 */
function parseHeaders(headers) {
  const result = {};
  const headerMap = {
    'Message-ID': 'message_id',
    'In-Reply-To': 'in_reply_to',
    'References': 'references',
    'From': 'from',
    'To': 'to',
    'Cc': 'cc',
    'Subject': 'subject',
    'Date': 'date'
  };

  headers.forEach(header => {
    const mappedName = headerMap[header.name];
    if (mappedName) {
      result[mappedName] = header.value;
    }
  });

  return result;
}

/**
 * Parse email body from Gmail message parts
 */
function parseBody(payload) {
  let bodyHtml = '';
  let bodyText = '';

  function extractBody(part) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  }

  extractBody(payload);

  return { bodyHtml, bodyText };
}

/**
 * Parse attachments from Gmail message
 */
function parseAttachments(payload, gmailMessageId) {
  const attachments = [];

  function extractAttachments(part) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mime_type: part.mimeType,
        size: part.body.size,
        attachment_id: part.body.attachmentId,
        gmail_message_id: gmailMessageId,
        is_inline: part.headers?.some(h => h.name === 'Content-Disposition' && h.value.includes('inline'))
      });
    }

    if (part.parts) {
      part.parts.forEach(extractAttachments);
    }
  }

  extractAttachments(payload);

  return attachments;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmail_thread_id } = await req.json();

    if (!gmail_thread_id) {
      return Response.json({ error: 'Missing gmail_thread_id' }, { status: 400 });
    }

    // Fetch thread from Gmail
    const threadData = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}`,
      'GET',
      null,
      { format: 'full' }
    );

    // Check if thread exists in Base44
    let existingThread = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id: gmail_thread_id
    });

    let threadId;

    if (existingThread.length > 0) {
      // Update existing thread
      threadId = existingThread[0].id;
      const lastMessage = threadData.messages[threadData.messages.length - 1];
      const headers = parseHeaders(lastMessage.payload.headers);
      const { bodyHtml, bodyText } = parseBody(lastMessage.payload);

      await base44.asServiceRole.entities.EmailThread.update(threadId, {
        subject: headers.subject,
        last_message_date: new Date(parseInt(lastMessage.internalDate)).toISOString(),
        last_message_snippet: lastMessage.snippet,
        message_count: threadData.messages.length,
        from_address: headers.from?.match(/<(.+)>/)?.[1] || headers.from,
        to_addresses: headers.to?.split(',').map(e => e.trim().match(/<(.+)>/)?.[1] || e.trim()) || []
      });
    } else {
      // Create new thread
      const firstMessage = threadData.messages[0];
      const headers = parseHeaders(firstMessage.payload.headers);

      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        gmail_thread_id: gmail_thread_id,
        subject: headers.subject,
        last_message_date: new Date(parseInt(firstMessage.internalDate)).toISOString(),
        last_message_snippet: firstMessage.snippet,
        message_count: threadData.messages.length,
        from_address: headers.from?.match(/<(.+)>/)?.[1] || headers.from,
        to_addresses: headers.to?.split(',').map(e => e.trim().match(/<(.+)>/)?.[1] || e.trim()) || [],
        status: 'Open',
        priority: 'Normal',
        is_read: false
      });

      threadId = newThread.id;
    }

    // Upsert messages
    const messages = [];
    for (const gmailMessage of threadData.messages) {
      const headers = parseHeaders(gmailMessage.payload.headers);
      const { bodyHtml, bodyText } = parseBody(gmailMessage.payload);
      const attachments = parseAttachments(gmailMessage.payload, gmailMessage.id);

      // Check if message already exists
      const existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
        gmail_message_id: gmailMessage.id
      });

      let messageData = {
        thread_id: threadId,
        gmail_message_id: gmailMessage.id,
        message_id: headers.message_id,
        in_reply_to: headers.in_reply_to || null,
        references: headers.references || null,
        from_address: headers.from?.match(/<(.+)>/)?.[1] || headers.from,
        from_name: headers.from?.match(/(.+)<.+>/)?.[1]?.trim() || headers.from,
        to_addresses: headers.to?.split(',').map(e => e.trim().match(/<(.+)>/)?.[1] || e.trim()) || [],
        cc_addresses: headers.cc?.split(',').map(e => e.trim().match(/<(.+)>/)?.[1] || e.trim()) || [],
        subject: headers.subject,
        body_html: bodyHtml,
        body_text: bodyText,
        attachments: attachments,
        sent_at: new Date(parseInt(gmailMessage.internalDate)).toISOString(),
        is_outbound: false
      };

      if (existingMessages.length > 0) {
        await base44.asServiceRole.entities.EmailMessage.update(existingMessages[0].id, messageData);
        messages.push({ ...existingMessages[0], ...messageData });
      } else {
        const newMessage = await base44.asServiceRole.entities.EmailMessage.create(messageData);
        messages.push(newMessage);
      }
    }

    // Return normalized thread data
    const thread = await base44.asServiceRole.entities.EmailThread.get(threadId);

    return Response.json({
      thread,
      messages
    });
  } catch (error) {
    console.error('Error getting Gmail thread:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});