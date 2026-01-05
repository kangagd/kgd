import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

const fixEncodingIssues = (text) => {
  if (text == null) return text;
  let fixed = String(text);

  // 1) Common HTML entities
  fixed = fixed
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'")   // '
    .replace(/&#8216;/g, "'")   // '
    .replace(/&#8220;/g, '"')   // "
    .replace(/&#8221;/g, '"')   // "
    .replace(/&#8211;/g, "–")  // –
    .replace(/&#8212;/g, "—"); // —

  // 2) UTF-8 → Windows-1252 mojibake patterns
  const mojibakeReplacements = [
    // Smart quotes & dashes (â… sequences)
    [/â/g, "'"],
    [/â/g, "'"],
    [/â/g, """],
    [/â/g, """],
    [/â/g, "–"],
    [/â/g, "—"],
    [/â¦/g, "…"],

    // Variants already in the old helper
    [/â€™/g, "'"],
    [/â€˜/g, "'"],
    [/â€œ/g, """],
    [/â€/g, """],
    [/â€¢/g, "•"],

    // Spaces / NBSP / odd spacing
    [/Â /g, " "],
    [/Â/g, " "],
    [/â€‰/g, " "],
    [/â €/g, " "],

    // Misc symbols
    [/Â°/g, "°"],
    [/â‚¬/g, "€"],
    [/â ·/g, "·"],
    [/â ·â(\d+)/g, " ·$1"],
    [/Ã¢â‚¬â„¢/g, "'"],
  ];

  for (const [pattern, replacement] of mojibakeReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

  // 3) Accented characters (Ã… style patterns)
  const accentReplacements = [
    [/Ã /g, "à"],
    [/Ã¡/g, "á"],
    [/Ã¢/g, "â"],
    [/Ã£/g, "ã"],
    [/Ã¤/g, "ä"],
    [/Ã¨/g, "è"],
    [/Ã©/g, "é"],
    [/Ãª/g, "ê"],
    [/Ã«/g, "ë"],
    [/Ã¬/g, "ì"],
    [/Ã­/g, "í"],
    [/Ã®/g, "î"],
    [/Ã¯/g, "ï"],
    [/Ã²/g, "ò"],
    [/Ã³/g, "ó"],
    [/Ã´/g, "ô"],
    [/Ãµ/g, "õ"],
    [/Ã¶/g, "ö"],
    [/Ã¹/g, "ù"],
    [/Ãº/g, "ú"],
    [/Ã»/g, "û"],
    [/Ã¼/g, "ü"],
  ];

  for (const [pattern, replacement] of accentReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

  return fixed;
};

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
    
    // Check authentication first
    const currentUser = await base44.auth.me();
    console.log('Current user:', currentUser);
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch full user record with gmail tokens using service role
    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (users.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    
    let user = users[0];

    // If manager doesn't have Gmail connected, try to use admin's Gmail connection
    if (!user.gmail_access_token && currentUser.extended_role === 'manager') {
      const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const connectedAdmin = adminUsers.find(admin => admin.gmail_access_token);
      if (connectedAdmin) {
        user = connectedAdmin;
        console.log('Manager using admin Gmail connection:', connectedAdmin.email);
      }
    }

    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected', synced: 0 }, { status: 200 });
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(user, base44);

    // Fetch recent inbox messages (limit 30)
    const inboxResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=INBOX',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!inboxResponse.ok) {
      const error = await inboxResponse.text();
      console.error('Gmail inbox fetch failed:', error);
      return Response.json({ error: 'Failed to fetch Gmail inbox', details: error, synced: 0 }, { status: 200 });
    }

    // Fetch recent sent messages (limit 30)
    const sentResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=SENT',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const inboxData = await inboxResponse.json();
    const sentData = sentResponse.ok ? await sentResponse.json() : { messages: [] };

    console.log('=== Gmail Sync Started ===');
    console.log('Inbox messages:', inboxData.messages?.length || 0);
    console.log('Sent messages:', sentData.messages?.length || 0);

    // Deduplicate messages using interleaving to ensure mix
    const messageMap = new Map();
    const inboxMsgs = inboxData.messages || [];
    const sentMsgs = sentData.messages || [];
    const maxLength = Math.max(inboxMsgs.length, sentMsgs.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < inboxMsgs.length) {
        const m = inboxMsgs[i];
        if (!messageMap.has(m.id)) {
          messageMap.set(m.id, { ...m, isOutbound: false });
        }
      }
      if (i < sentMsgs.length) {
        const m = sentMsgs[i];
        if (messageMap.has(m.id)) {
          messageMap.get(m.id).isOutbound = true;
        } else {
          messageMap.set(m.id, { ...m, isOutbound: true });
        }
      }
    }
    
    const allMessages = Array.from(messageMap.values());

    if (allMessages.length === 0) {
      return Response.json({ synced: 0, message: 'No messages to sync' });
    }

    // Helper function to process a single message
    async function processMessage(message) {
      try {
        // Quick check if already exists
        const existing = await base44.asServiceRole.entities.EmailMessage.filter({
           gmail_message_id: message.id
        });
        if (existing.length > 0) {
           return false;
        }

        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!detailResponse.ok) {
          console.error(`Failed to fetch message ${message.id}`);
          return false;
        }

        const detail = await detailResponse.json();
        if (!detail.payload?.headers) {
          console.error(`Invalid message format for ${message.id}`);
          return false;
        }

        const headers = detail.payload.headers;

        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const messageId = headers.find(h => h.name === 'Message-ID')?.value;
        const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value;

        if (!date) {
          console.error(`Missing date for message ${message.id}`);
          return false;
        }
        
        // Use gmail message ID as fallback if Message-ID header is missing
        const effectiveMessageId = messageId || message.id;

        // Use Gmail's threadId to group messages into threads
        const gmailThreadId = detail.threadId;
        
        // Check if thread already exists by Gmail thread ID
        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: gmailThreadId
        });

        let threadId;

        if (existingThreads.length > 0) {
          threadId = existingThreads[0].id;
          // Update last message date and message count
          const messageDate = new Date(date).toISOString();
          const updateData = {
            last_message_snippet: detail.snippet
          };
          // Only update last_message_date if this message is newer
          if (!existingThreads[0].last_message_date || new Date(messageDate) > new Date(existingThreads[0].last_message_date)) {
            updateData.last_message_date = messageDate;
          }
          
          // Auto-link: If thread is already linked to project/customer, inherit those links
          // This ensures new messages on existing threads automatically get the project linkage
          if (existingThreads[0].project_id && !updateData.project_id) {
            updateData.project_id = existingThreads[0].project_id;
            updateData.project_number = existingThreads[0].project_number;
            updateData.project_title = existingThreads[0].project_title;
          }
          if (existingThreads[0].customer_id && !updateData.customer_id) {
            updateData.customer_id = existingThreads[0].customer_id;
            updateData.customer_name = existingThreads[0].customer_name;
          }
          
          await base44.asServiceRole.entities.EmailThread.update(threadId, updateData);
        } else {
          // Create new thread with Gmail thread ID
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
          
          // Auto-link to customer and project based on email addresses
          try {
            const fromEmail = parseEmailAddress(from).toLowerCase();
            const allEmails = [fromEmail, ...to.split(',').map(e => parseEmailAddress(e.trim()).toLowerCase())];
            
            // Find matching customers
            const customers = await base44.asServiceRole.entities.Customer.list();
            const matchingCustomer = customers.find(c => 
              c.email && allEmails.includes(c.email.toLowerCase())
            );
            
            if (matchingCustomer) {
              // Find most recent open project for this customer
              const projects = await base44.asServiceRole.entities.Project.filter({
                customer_id: matchingCustomer.id
              });
              
              const openProjects = projects.filter(p => 
                !['Completed', 'Lost', 'Cancelled'].includes(p.status)
              ).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
              
              const projectToLink = openProjects[0];
              
              if (projectToLink) {
                await base44.asServiceRole.entities.EmailThread.update(threadId, {
                  customer_id: matchingCustomer.id,
                  customer_name: matchingCustomer.name,
                  project_id: projectToLink.id,
                  project_number: projectToLink.project_number,
                  project_title: projectToLink.title,
                  linked_to_project_at: new Date().toISOString(),
                  linked_to_project_by: 'system'
                });
                console.log(`Auto-linked thread ${threadId} to project ${projectToLink.id}`);
              } else {
                await base44.asServiceRole.entities.EmailThread.update(threadId, {
                  customer_id: matchingCustomer.id,
                  customer_name: matchingCustomer.name
                });
                console.log(`Auto-linked thread ${threadId} to customer ${matchingCustomer.id}`);
              }
            }
          } catch (linkError) {
            console.error('Auto-link error:', linkError.message);
          }
        }

        // Double check check message existence (race condition safety)
        let existingMessagesCheck = [];
        try {
          existingMessagesCheck = await base44.asServiceRole.entities.EmailMessage.filter({
            gmail_message_id: message.id
          });
        } catch (filterError) {
          console.log(`Filter error for ${message.id}`, filterError.message);
        }
        
        if (existingMessagesCheck.length > 0) {
          return false;
        }
        
        // Extract body and attachments
        let bodyHtml = '';
        let bodyText = detail.snippet || '';
        const attachments = [];
        const inlineImages = [];

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
              
              if (part.filename && part.filename.length > 0) {
                const attachmentId = part.body?.attachmentId;
                if (attachmentId) {
                  const contentIdHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
                  const contentDisposition = part.headers?.find(h => h.name.toLowerCase() === 'content-disposition');
                  const contentId = contentIdHeader?.value?.replace(/[<>]/g, '');
                  const isInline = contentDisposition?.value?.toLowerCase().includes('inline') || !!contentId;
                  
                  const attachmentData = {
                    filename: part.filename,
                    mime_type: part.mimeType,
                    size: parseInt(part.body.size) || 0,
                    attachment_id: attachmentId,
                    gmail_message_id: message.id,
                    content_id: contentId || null,
                    is_inline: isInline
                  };
                  
                  attachments.push(attachmentData);
                  if (isInline && contentId) {
                    inlineImages.push(attachmentData);
                  }
                }
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

        const processedAttachments = attachments.map(att => ({
          filename: att.filename,
          mime_type: att.mime_type,
          size: att.size,
          attachment_id: att.attachment_id,
          gmail_message_id: att.gmail_message_id,
          content_id: att.content_id || null,
          is_inline: att.is_inline || false
        }));
        
        const toAddresses = to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [];
        const fromAddress = parseEmailAddress(from) || 'unknown@unknown.com';
        
        const userEmail = user.gmail_email || user.email;
        const isOutbound = message.isOutbound || 
          fromAddress.toLowerCase() === userEmail.toLowerCase() ||
          detail.labelIds?.includes('SENT');

        const messageData = {
          thread_id: threadId,
          gmail_message_id: message.id,
          from_address: fromAddress,
          to_addresses: toAddresses.length > 0 ? toAddresses : [fromAddress],
          sent_at: new Date(date).toISOString(),
          subject: fixEncodingIssues(subject || '(No Subject)'),
          body_html: fixEncodingIssues(bodyHtml),
          body_text: fixEncodingIssues(bodyText),
          message_id: effectiveMessageId,
          is_outbound: isOutbound,
          attachments: processedAttachments.length > 0 ? processedAttachments : undefined
        };
        
        if (inReplyTo) {
          messageData.in_reply_to = inReplyTo;
        }
        
        try {
          await base44.asServiceRole.entities.EmailMessage.create(messageData);
        } catch (createError) {
          console.error(`>>> FAILED TO CREATE MESSAGE: ${createError.message}`);
          return false;
        }
        
        // Update thread message count and auto-save attachments
        try {
          const currentThread = await base44.asServiceRole.entities.EmailThread.get(threadId);
          await base44.asServiceRole.entities.EmailThread.update(threadId, {
            message_count: (currentThread.message_count || 0) + 1
          });

          // Update project activity if thread is linked to a project
          if (currentThread.linked_project_id) {
            await updateProjectActivity(base44, currentThread.linked_project_id);
          }

          // Update project last contact timestamps
          if (currentThread.project_id) {
            base44.functions.invoke('updateProjectLastContactFromThread', {
              email_thread_id: threadId
            }).catch(err => console.error('Update project contact failed:', err));
          }

          if (processedAttachments.length > 0) {
            if (currentThread.linked_project_id) {
              base44.functions.invoke('saveThreadAttachments', {
                thread_id: threadId,
                target_type: 'project',
                target_id: currentThread.linked_project_id
              }).catch(err => console.error('Auto-save attachments failed:', err));
            } else if (currentThread.linked_job_id) {
              base44.functions.invoke('saveThreadAttachments', {
                thread_id: threadId,
                target_type: 'job',
                target_id: currentThread.linked_job_id
              }).catch(err => console.error('Auto-save attachments failed:', err));
            }
          }
        } catch (e) {
          console.log('Error updating thread:', e.message);
        }

        return true; // Synced successfully
      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError.message);
        return false;
      }
    }

    // Process with concurrency
    const CONCURRENCY = 3;
    const queue = allMessages.slice(0, 60); // Limit total processing to 60
    const results = [];
    
    console.log(`Processing ${queue.length} messages with concurrency ${CONCURRENCY}...`);
    
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      const chunk = queue.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(m => processMessage(m)));
      results.push(...chunkResults);
    }
    
    const syncedCount = results.filter(Boolean).length;

    console.log(`=== Gmail Sync Complete: ${syncedCount} new messages synced ===`);
    return Response.json({ synced: syncedCount, total: queue.length });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return Response.json({ 
      error: error.message || 'Sync failed', 
      synced: 0 
    }, { status: 200 });
  }
});