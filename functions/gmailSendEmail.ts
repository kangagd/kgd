/**
 * gmailSendEmail - Send email from shared inbox
 * 
 * Modes:
 *   - new: Send new email
 *   - reply: Reply to message in thread (with In-Reply-To + References)
 *   - forward: Forward message (optional: can be in-thread or new thread)
 * 
 * All emails sent from admin@kangaroogd.com.au with audit trail.
 * Stores sent messages and updates thread metadata.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClientV2.js';

/**
 * Build RFC 2822 MIME message
 */
function buildMimeMessage(to, subject, bodyHtml, cc, bcc, inReplyTo, references, attachments) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];

  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  
  // RFC threading headers
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  }

  let body = headers.join('\r\n') + '\r\n\r\n';

  // HTML part
  body += `--${boundary}\r\n`;
  body += `Content-Type: text/html; charset="UTF-8"\r\n`;
  body += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
  body += bodyHtml + '\r\n';

  // Attachments (if any)
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n`;
      body += `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n`;
      body += att.data + '\r\n';
    }
  }

  body += `--${boundary}--`;

  // Encode to base64url for Gmail API
  const encoded = btoa(unescape(encodeURIComponent(body)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return encoded;
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

    // Only admin and manager can send
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json({ error: 'Forbidden: Only admin/manager can send emails' }, { status: 403 });
    }

    stage = 'parse_request';
    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};

    const {
      mode = 'new', // new | reply | forward
      to,
      subject,
      body_html,
      cc = null,
      bcc = null,
      thread_id, // Base44 thread ID
      gmail_thread_id, // Gmail thread ID (required for reply)
      reply_to_gmail_message_id, // For reply: which message we're replying to
      project_id = null,
      job_id = null,
      attachments = []
    } = requestBody;

    stage = 'validate_fields';

    // Required fields
    if (!to || !subject || !body_html) {
      const missing = [];
      if (!to) missing.push('to');
      if (!subject) missing.push('subject');
      if (!body_html) missing.push('body_html');
      return Response.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Reply requires thread context
    if (mode === 'reply' && (!gmail_thread_id || !reply_to_gmail_message_id)) {
      return Response.json(
        { error: 'Reply mode requires gmail_thread_id and reply_to_gmail_message_id' },
        { status: 400 }
      );
    }

    stage = 'fetch_reply_context';
    let inReplyTo = null;
    let references = null;

    if (mode === 'reply') {
      // Fetch the message we're replying to for RFC headers
      try {
        const replyMsg = await gmailFetch(
          `/gmail/v1/users/me/messages/${reply_to_gmail_message_id}`,
          'GET',
          null,
          { format: 'metadata' }
        );

        const headers = {};
        if (replyMsg.payload?.headers) {
          replyMsg.payload.headers.forEach(h => {
            headers[h.name.toLowerCase()] = h.value;
          });
        }

        inReplyTo = headers['message-id'] || null;
        // Build References chain: existing refs + in-reply-to
        if (inReplyTo) {
          if (headers['references']) {
            references = `${headers['references']} ${inReplyTo}`;
          } else {
            references = inReplyTo;
          }
        }
      } catch (err) {
        console.error('[gmailSendEmail] Error fetching reply context:', err);
      }
    }

    stage = 'build_mime';
    const rawMessage = buildMimeMessage(to, subject, body_html, cc, bcc, inReplyTo, references, attachments);

    stage = 'gmail_send';
    const sendPayload = {
      raw: rawMessage
    };

    // For reply, include threadId to keep it in the same thread
    if (mode === 'reply' && gmail_thread_id) {
      sendPayload.threadId = gmail_thread_id;
    }

    const sendResult = await gmailFetch('/gmail/v1/users/me/messages/send', 'POST', sendPayload);

    stage = 'fetch_sent_metadata';
    // Fetch sent message to capture proper Message-ID header
    const sentMsg = await gmailFetch(
      `/gmail/v1/users/me/messages/${sendResult.id}`,
      'GET',
      null,
      { format: 'metadata' }
    );

    let messageId = `<${sendResult.id}@gmail.com>`;
    if (sentMsg.payload?.headers) {
      const msgIdHeader = sentMsg.payload.headers.find(h => h.name.toLowerCase() === 'message-id');
      if (msgIdHeader?.value) {
        messageId = msgIdHeader.value;
      }
    }

    stage = 'upsert_thread';
    // Find or create thread in Base44
    let threadId = thread_id;

    if (!threadId) {
      // For new emails, create new thread
      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        subject,
        gmail_thread_id: sendResult.threadId,
        from_address: Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au',
        to_addresses: to.split(',').map(e => e.trim()),
        last_message_date: new Date().toISOString(),
        last_message_snippet: body_html.replace(/<[^>]*>/g, '').substring(0, 100),
        message_count: 1,
        is_read: true,
        project_id: project_id || null,
        job_id: job_id || null
      });
      threadId = newThread.id;
    } else {
      // Update existing thread
      const threadUpdates = {
        last_message_date: new Date().toISOString(),
        last_message_snippet: body_html.replace(/<[^>]*>/g, '').substring(0, 100),
        message_count: (await base44.asServiceRole.entities.EmailMessage.filter({ thread_id })).length + 1,
        is_read: true
      };
      
      // Update project/job links if provided
      if (project_id) threadUpdates.project_id = project_id;
      if (job_id) threadUpdates.job_id = job_id;

      await base44.asServiceRole.entities.EmailThread.update(threadId, threadUpdates);
    }

    stage = 'store_message';
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';

    // Store sent message with audit trail
    await base44.asServiceRole.entities.EmailMessage.create({
      thread_id: threadId,
      gmail_message_id: sendResult.id,
      gmail_thread_id: sendResult.threadId,
      from_address: impersonateEmail,
      from_name: user.display_name || user.full_name || impersonateEmail,
      to_addresses: to.split(',').map(e => e.trim()),
      cc_addresses: cc ? cc.split(',').map(e => e.trim()) : [],
      bcc_addresses: bcc ? bcc.split(',').map(e => e.trim()) : [],
      subject,
      body_html,
      is_outbound: true,
      sent_at: new Date().toISOString(),
      message_id: messageId,
      in_reply_to: inReplyTo,
      references: references,
      performed_by_user_id: user.id,
      performed_by_user_email: user.email,
      performed_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      messageId: sendResult.id,
      threadId: sendResult.threadId,
      baseThreadId: threadId
    });
  } catch (error) {
    console.error(`[gmailSendEmail] Error at stage '${stage}':`, error);
    return Response.json(
      { error: error.message, stage },
      { status: 500 }
    );
  }
});