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
      return Response.json({ threads: [], found: 0 });
    }

    // Fetch thread details for display
    const threadMap = new Map();
    const MAX_THREADS = 5; // Reduced significantly for rate limiting
    const INITIAL_DELAY_MS = 1000; // Start with 1 second delay

    for (let i = 0; i < Math.min(MAX_THREADS, messageIds.length); i++) {
      const msg = messageIds[i];

      // Exponential backoff delay
      if (i > 0) {
        const delay = INITIAL_DELAY_MS * Math.pow(1.5, i - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&headers=Subject,From,Date`;
        const msgResponse = await fetch(msgUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!msgResponse.ok) {
          if (msgResponse.status === 429) {
            console.warn('Rate limited - backing off');
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          }
          continue;
        }

        const detail = await msgResponse.json();
        const headers = detail.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const gmailThreadId = detail.threadId;

        if (!threadMap.has(gmailThreadId)) {
          // Check if already synced AND has messages (not a ghost thread)
          const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
            gmail_thread_id: gmailThreadId
          });

          let isSynced = false;
          let syncedId = null;

          if (existingThreads.length > 0) {
            const thread = existingThreads[0];
            // Only mark as synced if the thread has messages
            const messages = await base44.asServiceRole.entities.EmailMessage.filter({
              thread_id: thread.id
            });
            if (messages.length > 0) {
              isSynced = true;
              syncedId = thread.id;
            }
          }

          threadMap.set(gmailThreadId, {
            gmail_thread_id: gmailThreadId,
            subject,
            from,
            snippet: detail.snippet || '',
            date,
            is_synced: isSynced,
            synced_id: syncedId
          });
        }
      } catch (err) {
        console.error(`Error fetching message ${msg.id}:`, err);
      }
    }

    const threads = Array.from(threadMap.values());
    return Response.json({ threads, found: messageIds.length });
  } catch (error) {
    console.error('Search Gmail history error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});