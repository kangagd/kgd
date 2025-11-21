import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshTokenIfNeeded(user, base44) {
  const expiry = new Date(user.gmail_token_expiry);
  const now = new Date();
  
  // Refresh if token expires in less than 5 minutes
  if (expiry - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
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
    
    await base44.asServiceRole.entities.User.update(user.email, {
      gmail_access_token: tokens.access_token,
      gmail_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.gmail_access_token;
}

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(user, base44);

    // Fetch recent messages (last 100)
    const messagesResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=INBOX',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const messagesData = await messagesResponse.json();

    if (!messagesData.messages) {
      return Response.json({ synced: 0, message: 'No messages to sync' });
    }

    let syncedCount = 0;

    // Process each message
    for (const message of messagesData.messages.slice(0, 20)) { // Limit to 20 to avoid timeouts
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const detail = await detailResponse.json();
      const headers = detail.payload.headers;

      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value;
      const messageId = headers.find(h => h.name === 'Message-ID')?.value;
      const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value;

      // Check if thread already exists
      const existingThreads = await base44.entities.EmailThread.filter({
        subject: subject,
        from_address: parseEmailAddress(from)
      });

      let threadId;

      if (existingThreads.length > 0) {
        threadId = existingThreads[0].id;
        // Update last message date
        await base44.entities.EmailThread.update(threadId, {
          last_message_date: new Date(date).toISOString(),
          last_message_snippet: detail.snippet
        });
      } else {
        // Create new thread
        const newThread = await base44.entities.EmailThread.create({
          subject,
          from_address: parseEmailAddress(from),
          to_addresses: to.split(',').map(e => parseEmailAddress(e.trim())),
          last_message_date: new Date(date).toISOString(),
          last_message_snippet: detail.snippet,
          status: 'Open',
          priority: 'Normal',
          message_count: 1
        });
        threadId = newThread.id;
      }

      // Check if message already exists
      const existingMessages = await base44.entities.EmailMessage.filter({
        message_id: messageId
      });

      if (existingMessages.length === 0) {
        // Extract body
        let bodyHtml = '';
        let bodyText = detail.snippet;

        if (detail.payload.body?.data) {
          bodyText = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (detail.payload.parts) {
          for (const part of detail.payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              bodyHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
          }
        }

        // Create message
        await base44.entities.EmailMessage.create({
          thread_id: threadId,
          from_address: parseEmailAddress(from),
          to_addresses: to.split(',').map(e => parseEmailAddress(e.trim())),
          sent_at: new Date(date).toISOString(),
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          message_id: messageId,
          in_reply_to: inReplyTo,
          is_outbound: false
        });

        syncedCount++;
      }
    }

    return Response.json({ synced: syncedCount, total: messagesData.messages.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});