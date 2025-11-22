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
    
    // Check authentication first
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected', synced: 0 }, { status: 200 });
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(user, base44);

    // Fetch recent inbox messages
    const inboxResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    // Fetch recent sent messages
    const sentResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=SENT',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const inboxData = await inboxResponse.json();
    const sentData = await sentResponse.json();

    const allMessages = [
      ...(inboxData.messages || []).map(m => ({ ...m, isOutbound: false })),
      ...(sentData.messages || []).map(m => ({ ...m, isOutbound: true }))
    ];

    if (allMessages.length === 0) {
      return Response.json({ synced: 0, message: 'No messages to sync' });
    }

    let syncedCount = 0;

    // Process each message (limit to 30 to avoid timeouts)
    for (const message of allMessages.slice(0, 30)) {
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!detailResponse.ok) {
          console.error(`Failed to fetch message ${message.id}`);
          continue;
        }

        const detail = await detailResponse.json();
        if (!detail.payload?.headers) {
          console.error(`Invalid message format for ${message.id}`);
          continue;
        }

        const headers = detail.payload.headers;

        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const messageId = headers.find(h => h.name === 'Message-ID')?.value;
        const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value;

        if (!date || !messageId) {
          console.error(`Missing required fields for message ${message.id}`);
          continue;
        }

      // Check if thread already exists
      const existingThreads = await base44.entities.EmailThread.filter({
        subject: subject,
        from_address: parseEmailAddress(from)
      });

      let threadId;
      let isNewThread = false;

      if (existingThreads.length > 0) {
        threadId = existingThreads[0].id;
        // Update last message date
        await base44.entities.EmailThread.update(threadId, {
          last_message_date: new Date(date).toISOString(),
          last_message_snippet: detail.snippet
        });
      } else {
        isNewThread = true;
        // AI categorization and urgency detection for new threads
        let category = 'Uncategorized';
        let isUrgent = false;
        let urgencyReason = null;

        let priority = 'Normal';
        
        try {
          const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Analyze this email from a garage door service company and provide categorization.

Subject: ${subject}
From: ${from}
Body: ${detail.snippet}

Categories: Customer Inquiry, Quote Request, Job Update, Technical Issue, Payment/Invoice, Complaint, General/Other

Priority Guidelines:
- HIGH: Urgent issues, safety concerns, customer complaints, job delays, payment issues, time-sensitive quotes
- NORMAL: General inquiries, follow-ups, scheduling requests, routine updates
- LOW: Marketing emails, newsletters, informational content, non-urgent administrative emails

Also determine if this requires immediate attention (urgent flag).

Return JSON with category, priority (High/Normal/Low), is_urgent boolean, and urgency_reason.`,
            response_json_schema: {
              type: "object",
              properties: {
                category: { type: "string" },
                priority: { type: "string", enum: ["High", "Normal", "Low"] },
                is_urgent: { type: "boolean" },
                urgency_reason: { type: "string" }
              }
            }
          });

          category = aiResponse.category || 'Uncategorized';
          priority = aiResponse.priority || 'Normal';
          isUrgent = aiResponse.is_urgent || false;
          urgencyReason = aiResponse.urgency_reason;
        } catch (error) {
          console.error('AI categorization failed:', error);
        }

        // Create new thread with AI insights
        const newThread = await base44.entities.EmailThread.create({
          subject,
          from_address: parseEmailAddress(from),
          to_addresses: to.split(',').map(e => parseEmailAddress(e.trim())),
          last_message_date: new Date(date).toISOString(),
          last_message_snippet: detail.snippet,
          status: 'Open',
          priority: priority,
          message_count: 1,
          category: category,
          is_urgent: isUrgent,
          urgency_reason: urgencyReason
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
          let bodyText = detail.snippet || '';

          const processParts = (parts) => {
            if (!parts || !Array.isArray(parts)) return;
            for (const part of parts) {
              try {
                if (part.mimeType === 'text/html' && part.body?.data) {
                  const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                  if (decoded) bodyHtml = decoded;
                } else if (part.mimeType === 'text/plain' && part.body?.data) {
                  const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                  if (decoded) bodyText = decoded;
                }
                if (part.parts) {
                  processParts(part.parts);
                }
              } catch (err) {
                console.error('Error processing part:', err);
              }
            }
          };

          try {
            if (detail.payload.body?.data) {
              const decoded = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              if (decoded) bodyText = decoded;
            }
          } catch (err) {
            console.error('Error decoding body:', err);
          }
          
          if (detail.payload.parts) {
            processParts(detail.payload.parts);
          }

          // Parse addresses safely
          const toAddresses = to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [];
          const fromAddress = parseEmailAddress(from) || 'unknown@unknown.com';

          // Create message
          const messageData = {
            thread_id: threadId,
            from_address: fromAddress,
            to_addresses: toAddresses.length > 0 ? toAddresses : [fromAddress],
            sent_at: new Date(date).toISOString(),
            subject: subject || '(No Subject)',
            body_html: bodyHtml,
            body_text: bodyText,
            message_id: messageId,
            is_outbound: message.isOutbound
          };
          
          if (inReplyTo) {
            messageData.in_reply_to = inReplyTo;
          }
          
          await base44.entities.EmailMessage.create(messageData);

          syncedCount++;
        }
      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError.message);
        // Continue with next message
      }
    }

    return Response.json({ synced: syncedCount, total: allMessages.length });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return Response.json({ 
      error: error.message || 'Sync failed', 
      synced: 0 
    }, { status: 200 }); // Return 200 to prevent breaking the UI
  }
});