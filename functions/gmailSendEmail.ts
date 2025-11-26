import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshTokenIfNeeded(base44, user) {
  // If no token expiry set or token is expired/close to expiring
  const expiryTime = user.gmail_token_expiry ? new Date(user.gmail_token_expiry).getTime() : 0;
  const now = Date.now();
  
  if (!user.gmail_refresh_token) {
    throw new Error('Gmail refresh token not found. Please reconnect Gmail.');
  }
  
  if (expiryTime - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Gmail credentials not configured');
    }
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: user.gmail_refresh_token,
        grant_type: 'refresh_token'
      })
    });
    
    const tokens = await response.json();
    
    if (!response.ok || tokens.error) {
      throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error || 'Unknown error'}`);
    }
    
    await base44.asServiceRole.entities.User.update(user.id, {
      gmail_access_token: tokens.access_token,
      gmail_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.gmail_access_token;
}

function createMimeMessage(to, subject, body, cc, bcc, inReplyTo, references, attachments) {
  const boundary = `boundary_${Date.now()}`;
  let message = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];
  
  if (cc) message.push(`Cc: ${cc}`);
  if (bcc) message.push(`Bcc: ${bcc}`);
  if (inReplyTo) message.push(`In-Reply-To: ${inReplyTo}`);
  if (references) message.push(`References: ${references}`);
  
  message.push(`MIME-Version: 1.0`);
  message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  message.push('');
  message.push(`--${boundary}`);
  message.push('Content-Type: text/html; charset=UTF-8');
  message.push('');
  message.push(body);
  
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      message.push(`--${boundary}`);
      message.push(`Content-Type: ${attachment.mimeType || 'application/octet-stream'}; name="${attachment.filename}"`);
      message.push('Content-Transfer-Encoding: base64');
      message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      message.push('');
      message.push(attachment.data);
    }
  }
  
  message.push(`--${boundary}--`);
  
  return btoa(unescape(encodeURIComponent(message.join('\r\n'))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected. Please connect Gmail first.' }, { status: 401 });
    }
    
    const { to, cc, bcc, subject, body, threadId, inReplyTo, references, attachments } = await req.json();
    
    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const accessToken = await refreshTokenIfNeeded(base44, user);
    
    const encodedMessage = createMimeMessage(to, subject, body, cc, bcc, inReplyTo, references, attachments);
    
    const sendUrl = threadId 
      ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
      : `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
    
    const sendBody = { raw: encodedMessage };
    if (threadId) sendBody.threadId = threadId;
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${error}`);
    }
    
    const result = await response.json();
    
    // Store sent message in EmailMessage entity
    await base44.entities.EmailMessage.create({
      thread_id: threadId || result.threadId,
      from_address: user.gmail_email || user.email,
      from_name: user.full_name,
      to_addresses: [to],
      cc_addresses: cc ? [cc] : [],
      bcc_addresses: bcc ? [bcc] : [],
      subject: subject,
      body_html: body,
      is_outbound: true,
      sent_at: new Date().toISOString(),
      message_id: result.id
    });
    
    return Response.json({ success: true, messageId: result.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});