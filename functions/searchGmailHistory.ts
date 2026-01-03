import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshTokenIfNeeded(user, base44) {
  const expiry = new Date(user.gmail_token_expiry);
  const now = new Date();
  
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
    
    await base44.asServiceRole.entities.User.update(user.id, {
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
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (users.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    
    const user = users[0];

    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
    }
    
    const accessToken = await refreshTokenIfNeeded(user, base44);

    const { query, sender, recipient, dateFrom, dateTo, maxResults = 50 } = await req.json();

    if (!query && !sender && !recipient) {
      return Response.json({ error: 'At least one search parameter required' }, { status: 400 });
    }

    // Build Gmail search query
    const queryParts = [];
    if (query) queryParts.push(query);
    if (sender) queryParts.push(`from:${sender}`);
    if (recipient) queryParts.push(`to:${recipient}`);
    if (dateFrom) queryParts.push(`after:${dateFrom.replace(/-/g, '/')}`);
    if (dateTo) queryParts.push(`before:${dateTo.replace(/-/g, '/')}`);
    
    const gmailQuery = queryParts.join(' ');
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=${maxResults}`;
    
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Gmail API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    const messageIds = data.messages || [];

    if (messageIds.length === 0) {
      return Response.json({ synced: 0, found: 0 });
    }

    // Process and sync messages
    let syncedCount = 0;
    const seenThreadIds = new Set();

    for (const msg of messageIds) {
      try {
        // Check if message already exists
        const existingMsg = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: msg.id
        });
        
        if (existingMsg.length > 0) {
          continue;
        }

        // Fetch message details
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const msgResponse = await fetch(msgUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!msgResponse.ok) continue;

        const detail = await msgResponse.json();
        const headers = detail.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const messageId = headers.find(h => h.name === 'Message-ID')?.value || msg.id;
        const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value;

        if (!date) continue;

        const gmailThreadId = detail.threadId;
        
        // Find or create thread
        let threadId;
        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: gmailThreadId
        });

        if (existingThreads.length > 0) {
          if (existingThreads[0].is_deleted) continue;
          
          threadId = existingThreads[0].id;
          const messageDate = new Date(date).toISOString();
          const updateData = {
            last_message_snippet: detail.snippet
          };
          if (!existingThreads[0].last_message_date || new Date(messageDate) > new Date(existingThreads[0].last_message_date)) {
            updateData.last_message_date = messageDate;
          }
          await base44.asServiceRole.entities.EmailThread.update(threadId, updateData);
        } else {
          const newThread = await base44.asServiceRole.entities.EmailThread.create({
            subject,
            gmail_thread_id: gmailThreadId,
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

        // Extract body
        let bodyHtml = '';
        let bodyText = detail.snippet || '';

        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              if (decoded) bodyHtml = decoded;
            } else if (part.mimeType === 'text/plain' && part.body?.data) {
              const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              if (decoded) bodyText = decoded;
            }
            if (part.parts) processParts(part.parts);
          }
        };

        if (detail.payload.body?.data) {
          const decoded = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          if (decoded) bodyText = decoded;
        }
        
        if (detail.payload.parts) {
          processParts(detail.payload.parts);
        }

        const fromAddress = parseEmailAddress(from) || 'unknown@unknown.com';
        const toAddresses = to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [];
        const userEmail = user.gmail_email || user.email;
        const isOutbound = fromAddress.toLowerCase() === userEmail.toLowerCase() || detail.labelIds?.includes('SENT');

        // Create message
        await base44.asServiceRole.entities.EmailMessage.create({
          thread_id: threadId,
          gmail_message_id: msg.id,
          from_address: fromAddress,
          to_addresses: toAddresses.length > 0 ? toAddresses : [fromAddress],
          sent_at: new Date(date).toISOString(),
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          message_id: messageId,
          is_outbound: isOutbound,
          in_reply_to: inReplyTo || null
        });

        syncedCount++;

        // Update thread message count
        const currentThread = await base44.asServiceRole.entities.EmailThread.get(threadId);
        await base44.asServiceRole.entities.EmailThread.update(threadId, {
          message_count: (currentThread.message_count || 0) + 1
        });
      } catch (msgError) {
        console.error(`Error processing message ${msg.id}:`, msgError);
      }
    }

    return Response.json({ synced: syncedCount, found: messageIds.length });
  } catch (error) {
    console.error('Search Gmail history error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});