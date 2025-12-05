import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
    const { emails, projectId } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
       return Response.json({ error: 'Emails array required' }, { status: 400 });
    }

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

    // Build query: "from:(email1 OR email2) OR to:(email1 OR email2)"
    const emailQuery = emails.map(e => `"${e}"`).join(' OR ');
    const q = `from:(${emailQuery}) OR to:(${emailQuery})`;

    // List messages
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
       const error = await listResponse.text();
       throw new Error(`Gmail search failed: ${error}`);
    }

    const listData = await listResponse.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
        return Response.json({ messages: [] });
    }

    // Fetch metadata for each message
    const results = await Promise.all(messages.map(async (msg) => {
        try {
            const detailRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Message-ID`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            if (!detailRes.ok) return null;
            const detail = await detailRes.json();
            
            const headers = detail.payload.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const to = headers.find(h => h.name === 'To')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value;
            
            const fromAddress = parseEmailAddress(from);
            const userEmail = user.gmail_email || user.email;
            // Simple outbound check
            const isOutbound = fromAddress.toLowerCase() === userEmail.toLowerCase();
            const sentAt = date ? new Date(date).toISOString() : new Date().toISOString();

            // Upsert to ProjectEmail if projectId is provided
            if (projectId) {
              try {
                const existing = await base44.asServiceRole.entities.ProjectEmail.filter({ 
                  project_id: projectId, 
                  gmail_message_id: msg.id 
                });

                if (existing.length === 0) {
                  await base44.asServiceRole.entities.ProjectEmail.create({
                    project_id: projectId,
                    gmail_message_id: msg.id,
                    thread_id: detail.threadId,
                    subject: subject,
                    snippet: detail.snippet,
                    from_email: fromAddress,
                    to_email: to,
                    direction: isOutbound ? 'outgoing' : 'incoming',
                    sent_at: sentAt,
                    is_historical: true,
                    source: 'gmail',
                    created_at: new Date().toISOString()
                  });
                }
              } catch (err) {
                console.error(`Failed to upsert ProjectEmail for ${msg.id}:`, err);
              }
            }

            return {
                gmail_message_id: msg.id,
                thread_id: detail.threadId,
                subject,
                snippet: detail.snippet,
                sent_at: sentAt,
                is_outbound: isOutbound,
                from_address: fromAddress,
                from_name: from.replace(/<.*>/, '').trim(),
                to_addresses: to ? to.split(',').map(e => parseEmailAddress(e.trim())) : [],
                isHistorical: true,
                body_text: detail.snippet, // Fallback
                attachments: [] // Populated on full fetch
            };
        } catch (e) {
            console.error(`Failed to fetch details for ${msg.id}`, e);
            return null;
        }
    }));

    return Response.json({ messages: results.filter(Boolean) });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});