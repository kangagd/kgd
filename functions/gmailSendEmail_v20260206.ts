import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

console.log("[DEPLOY_SENTINEL] gmailSendEmail_v20260206 v=2026-02-05");

// ============================================================================
// Base64 Encoding Helpers
// ============================================================================

function base64urlEncode(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function wrapBase64(base64Data, lineLength = 76) {
  const lines = [];
  for (let i = 0; i < base64Data.length; i += lineLength) {
    lines.push(base64Data.substring(i, i + lineLength));
  }
  return lines.join('\r\n');
}

// ============================================================================
// MIME Message Construction
// ============================================================================

async function buildMimeMessage({ to, cc, bcc, subject, body_html, body_text, attachments, inReplyTo, references }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const relatedBoundary = `----=_Related_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  let message = '';
  
  // Headers
  message += `To: ${to.join(', ')}\r\n`;
  if (cc && cc.length > 0) message += `Cc: ${cc.join(', ')}\r\n`;
  if (bcc && bcc.length > 0) message += `Bcc: ${bcc.join(', ')}\r\n`;
  message += `Subject: ${subject}\r\n`;
  
  if (inReplyTo) message += `In-Reply-To: ${inReplyTo}\r\n`;
  if (references) message += `References: ${references}\r\n`;
  
  message += `MIME-Version: 1.0\r\n`;
  
  // Separate inline (cid:) and regular attachments
  const inlineAttachments = (attachments || []).filter(a => a.is_inline && a.content_id);
  const regularAttachments = (attachments || []).filter(a => !a.is_inline || !a.content_id);
  
  const hasInline = inlineAttachments.length > 0;
  const hasRegular = regularAttachments.length > 0;
  
  // Choose MIME structure
  if (hasRegular) {
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    message += `--${boundary}\r\n`;
  }
  
  if (hasInline) {
    message += `Content-Type: multipart/related; boundary="${relatedBoundary}"\r\n\r\n`;
    message += `--${relatedBoundary}\r\n`;
  }
  
  // Body (alternative: text + html)
  if (body_html && body_text) {
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    message += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    
    message += `--${altBoundary}\r\n`;
    message += `Content-Type: text/plain; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += wrapBase64(btoa(unescape(encodeURIComponent(body_text)))) + '\r\n\r\n';
    
    message += `--${altBoundary}\r\n`;
    message += `Content-Type: text/html; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += wrapBase64(btoa(unescape(encodeURIComponent(body_html)))) + '\r\n\r\n';
    
    message += `--${altBoundary}--\r\n`;
  } else if (body_html) {
    message += `Content-Type: text/html; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += wrapBase64(btoa(unescape(encodeURIComponent(body_html)))) + '\r\n\r\n';
  } else {
    message += `Content-Type: text/plain; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += wrapBase64(btoa(unescape(encodeURIComponent(body_text || '')))) + '\r\n\r\n';
  }
  
  // Inline attachments
  if (hasInline) {
    for (const att of inlineAttachments) {
      const fileResponse = await fetch(att.url);
      const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
      const fileBase64 = btoa(String.fromCharCode(...fileBytes));
      
      message += `--${relatedBoundary}\r\n`;
      message += `Content-Type: ${att.mime_type || 'application/octet-stream'}\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `Content-Disposition: inline; filename="${att.filename}"\r\n`;
      message += `Content-ID: <${att.content_id}>\r\n\r\n`;
      message += wrapBase64(fileBase64) + '\r\n\r\n';
    }
    message += `--${relatedBoundary}--\r\n`;
  }
  
  // Regular attachments
  if (hasRegular) {
    for (const att of regularAttachments) {
      const fileResponse = await fetch(att.url);
      const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
      const fileBase64 = btoa(String.fromCharCode(...fileBytes));
      
      message += `--${boundary}\r\n`;
      message += `Content-Type: ${att.mime_type || 'application/octet-stream'}; name="${att.filename}"\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n`;
      message += wrapBase64(fileBase64) + '\r\n\r\n';
    }
    message += `--${boundary}--\r\n`;
  }
  
  return message;
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      to, 
      cc, 
      bcc, 
      subject, 
      body_html, 
      body_text, 
      attachments,
      thread_id,
      in_reply_to,
      references
    } = body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return Response.json({ error: 'Missing or invalid "to" field' }, { status: 400 });
    }

    if (!subject && !in_reply_to) {
      return Response.json({ error: 'Missing subject (required for new emails)' }, { status: 400 });
    }

    // Build MIME message
    const mimeMessage = await buildMimeMessage({
      to,
      cc,
      bcc,
      subject: subject || '(No Subject)',
      body_html,
      body_text,
      attachments,
      inReplyTo: in_reply_to,
      references
    });

    const encodedMessage = base64urlEncode(mimeMessage);

    // Get Gmail access token from app connector
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");

    // Send via Gmail API
    const sendResponse = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage,
          threadId: thread_id || undefined
        })
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Gmail send failed: ${sendResponse.status} - ${errorText}`);
    }

    const result = await sendResponse.json();

    // Create EmailMessage record (only if we have a thread_id)
    if (thread_id) {
      const messageData = {
        thread_id: thread_id,
        gmail_message_id: result.id,
        gmail_thread_id: result.threadId,
        from_address: currentUser.email,
        to_addresses: to,
        cc_addresses: cc || [],
        bcc_addresses: bcc || [],
        subject: subject || '(No Subject)',
        body_html: body_html || '',
        body_text: body_text || '',
        sent_at: new Date().toISOString(),
        is_outbound: true,
        attachments: attachments || [],
        has_body: !!(body_html || body_text),
        sync_status: 'ok'
      };

      if (in_reply_to) {
        messageData.in_reply_to = in_reply_to;
      }

      await base44.asServiceRole.entities.EmailMessage.create(messageData);
    }

    // Update thread if exists
    if (thread_id) {
      try {
        const threadMessages = await base44.asServiceRole.entities.EmailMessage.filter({ thread_id });
        await base44.asServiceRole.entities.EmailThread.update(thread_id, {
          last_message_date: new Date().toISOString(),
          message_count: threadMessages.length
        });
      } catch (err) {
        console.error('Failed to update thread:', err.message);
      }
    }

    console.log(`Email sent successfully: ${result.id}`);

    return Response.json({ 
      success: true, 
      gmail_message_id: result.id,
      gmail_thread_id: result.threadId,
      version: '2026-02-05'
    });

  } catch (error) {
    console.error('Send email error:', error);
    return Response.json({ 
      error: error.message,
      version: '2026-02-05'
    }, { status: 500 });
  }
});