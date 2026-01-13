import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmailMessageId, gmailThreadId, threadId } = await req.json();

    if (!gmailMessageId || !threadId) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Check if message already exists (dedupe)
    const existing = await base44.asServiceRole.entities.EmailMessage.filter({
      gmail_message_id: gmailMessageId
    });

    if (existing.length > 0) {
      return Response.json({
        success: true,
        message: 'Message already exists',
        messageId: existing[0].id
      });
    }

    // Get Gmail access token
    const accessToken = await getGmailAccessToken(user.email);

    // Fetch message from Gmail
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch message: ${response.statusText}`);
    }

    const message = await response.json();

    // Parse message headers
    const headers = {};
    message.payload.headers.forEach(h => {
      headers[h.name.toLowerCase()] = h.value;
    });

    // Parse body
    let bodyHtml = '';
    let bodyText = '';

    function extractBody(part) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        part.parts.forEach(extractBody);
      }
    }

    if (message.payload.parts) {
      message.payload.parts.forEach(extractBody);
    } else if (message.payload.body?.data) {
      const mimeType = message.payload.mimeType;
      const content = decodeBase64Url(message.payload.body.data);
      if (mimeType === 'text/html') {
        bodyHtml = content;
      } else {
        bodyText = content;
      }
    }

    // Parse recipients
    const toAddresses = headers.to ? parseAddresses(headers.to) : [];
    const ccAddresses = headers.cc ? parseAddresses(headers.cc) : [];
    const bccAddresses = headers.bcc ? parseAddresses(headers.bcc) : [];

    // Create EmailMessage record
    const emailMessage = await base44.asServiceRole.entities.EmailMessage.create({
      thread_id: threadId,
      gmail_message_id: gmailMessageId,
      gmail_thread_id: gmailThreadId || message.threadId,
      from_address: parseAddress(headers.from),
      from_name: parseDisplayName(headers.from),
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      bcc_addresses: bccAddresses,
      subject: headers.subject || '',
      body_html: bodyHtml,
      body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ''),
      sent_at: new Date(parseInt(message.internalDate)).toISOString(),
      is_outbound: true,
      message_id: headers['message-id'],
      in_reply_to: headers['in-reply-to'],
      references: headers.references,
      performed_by_user_id: user.id,
      performed_by_user_email: user.email,
      performed_at: new Date().toISOString()
    });

    // Update thread last_message_date
    await base44.asServiceRole.entities.EmailThread.update(threadId, {
      last_message_date: new Date(parseInt(message.internalDate)).toISOString(),
      lastMessageDirection: 'sent',
      last_message_snippet: bodyText.substring(0, 200) || bodyHtml.replace(/<[^>]*>/g, '').substring(0, 200)
    });

    return Response.json({
      success: true,
      messageId: emailMessage.id
    });

  } catch (error) {
    console.error('Error importing sent message:', error);
    return Response.json({ 
      error: error.message || 'Failed to import sent message' 
    }, { status: 500 });
  }
});

function decodeBase64Url(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return str;
  }
}

function parseAddress(addressStr) {
  if (!addressStr) return '';
  const match = addressStr.match(/<(.+?)>/);
  return match ? match[1] : addressStr.trim();
}

function parseDisplayName(addressStr) {
  if (!addressStr) return '';
  const match = addressStr.match(/^(.+?)\s*</);
  return match ? match[1].trim().replace(/['"]/g, '') : '';
}

function parseAddresses(addressStr) {
  if (!addressStr) return [];
  return addressStr.split(',').map(addr => parseAddress(addr.trim()));
}

async function getGmailAccessToken(userEmail) {
  // TODO: Implement proper OAuth token retrieval
  throw new Error('Gmail OAuth not implemented - use existing auth mechanism');
}