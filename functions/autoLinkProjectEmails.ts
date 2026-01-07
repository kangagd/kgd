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

async function processProject(base44, project, gmailUser, accessToken) {
  const customerEmail = project.customer_email;
  
  if (!customerEmail) {
    return { 
      linkedCount: 0, 
      skippedCount: 0, 
      errorCount: 0,
      foundThreads: 0 
    };
  }

  console.log(`Searching Gmail history for emails with: ${customerEmail}`);

  // Search Gmail for historical emails with this customer (limited to prevent timeout)
  let syncedFromGmail = 0;
  try {
    const gmailQuery = customerEmail;
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=20`;
    
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      const messageIds = data.messages || [];
      console.log(`Found ${messageIds.length} messages in Gmail`);

      // Process and sync messages
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
            threadId = existingThreads[0].id;
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
          const userEmail = gmailUser.gmail_email || gmailUser.email;
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

          syncedFromGmail++;

          // Update thread message count
          const currentThread = await base44.asServiceRole.entities.EmailThread.get(threadId);
          await base44.asServiceRole.entities.EmailThread.update(threadId, {
            message_count: (currentThread.message_count || 0) + 1
          });

          // Rate limit - reduced for speed
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (msgError) {
          console.error(`Error processing message ${msg.id}:`, msgError);
        }
      }

      console.log(`Synced ${syncedFromGmail} new emails from Gmail`);
    }
  } catch (gmailError) {
    console.error('Gmail search error:', gmailError.message);
  }

  // Now search existing EmailThreads in the database that match the customer email
  const allThreads = await base44.asServiceRole.entities.EmailThread.list();
  const foundThreads = allThreads.filter(thread => {
    const fromMatches = thread.from_address?.toLowerCase().includes(customerEmail.toLowerCase());
    const toMatches = thread.to_addresses?.some(addr => 
      addr?.toLowerCase().includes(customerEmail.toLowerCase())
    );
    return fromMatches || toMatches;
  });

  console.log(`Found ${foundThreads.length} threads matching customer email`);

  let linkedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const thread of foundThreads) {
    try {
      // GUARDRAIL: Skip if already linked to ANY project - never override existing links
      if (thread.project_id) {
        console.log(`Thread ${thread.id} already linked to project ${thread.project_id}, skipping`);
        skippedCount++;
        continue;
      }

      // Link the thread to the project directly without calling the function
      await base44.asServiceRole.entities.EmailThread.update(thread.id, {
        project_id: project.id,
        project_number: project.project_number,
        project_title: project.title,
        linked_to_project_at: new Date().toISOString(),
        linked_to_project_by: 'system'
      });

      linkedCount++;
      console.log(`Linked thread ${thread.id} to project ${project.id}`);

    } catch (error) {
      console.error(`Error processing thread ${thread.id}:`, error);
      errorCount++;
      errors.push({
        thread_id: thread.id,
        error: error.message
      });
    }
  }

  return {
    syncedFromGmail,
    foundThreads: foundThreads.length,
    linkedCount,
    skippedCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Get Gmail user credentials
    const users = await base44.asServiceRole.entities.User.list();
    const gmailUser = users.find(u => u.gmail_access_token);

    if (!gmailUser) {
      return Response.json({ error: 'No Gmail connection found' }, { status: 400 });
    }

    const accessToken = await refreshTokenIfNeeded(gmailUser, base44);

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
      }

      const result = await processProject(base44, project, gmailUser, accessToken);

      return Response.json({
      success: true,
      customerEmail: project.customer_email,
      ...result
    });

  } catch (error) {
    console.error('Error in autoLinkProjectEmails:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});