import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
    }
    
    const accessToken = user.gmail_access_token;

    const { email, maxResults = 20 } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email address required' }, { status: 400 });
    }

    // Search Gmail using the API
    const query = `from:${email} OR to:${email}`;
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Gmail API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    const messageIds = data.messages || [];

    // Fetch details for each message
    const threads = [];
    const seenThreadIds = new Set();

    for (const msg of messageIds) {
      if (seenThreadIds.has(msg.threadId)) continue;
      seenThreadIds.add(msg.threadId);

      const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
      const msgResponse = await fetch(msgUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (msgResponse.ok) {
        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
        const snippet = msgData.snippet || '';

        // Check if already synced
        const existingThread = await base44.entities.EmailThread.filter({ 
          gmail_thread_id: msg.threadId 
        });

        threads.push({
          gmail_thread_id: msg.threadId,
          gmail_message_id: msg.id,
          subject,
          from,
          date,
          snippet,
          is_synced: existingThread.length > 0,
          synced_id: existingThread[0]?.id || null
        });
      }
    }

    return Response.json({ threads });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});