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
    
    const user = users[0];

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

    // Deduplicate messages
    const messageMap = new Map();
    
    // Interleave messages to ensure we process recent ones from both lists
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
          // Mark existing as outbound if found in sent
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

    let syncedCount = 0;
    
    // Helper for concurrency
    async function processMessage(message) {
      try {
        // Skip if already exists (quick check before fetch)
        const existing = await base44.asServiceRole.entities.EmailMessage.filter({
           gmail_message_id: message.id
        });
        if (existing.length > 0) {
           return false; // Skipped
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
          continue;
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
          continue;
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
        // Skip if thread was deleted by user
        if (existingThreads[0].is_deleted) {
          continue;
        }
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
        await base44.asServiceRole.entities.EmailThread.update(threadId, updateData);
        console.log(`Using existing thread ${threadId} for gmail thread ${gmailThreadId}`);
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
      }

      // Check if message already exists by gmail_message_id only (most reliable)
      let existingMessages = [];
      try {
        existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: message.id
        });
      } catch (filterError) {
        console.log(`Filter error for ${message.id}, assuming no existing:`, filterError.message);
      }
      
      console.log(`Message ${message.id}: found ${existingMessages.length} existing, threadId=${threadId}`);

      if (existingMessages.length > 0) {
        console.log(`Skipping existing message ${message.id}`);
        continue;
      }
      
      console.log(`>>> CREATING NEW MESSAGE for gmail_message_id: ${message.id}`);
        
        {
          // Extract body and attachments
          let bodyHtml = '';
          let bodyText = detail.snippet || '';
          const attachments = [];
          const inlineImages = []; // Track inline images with Content-ID

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
                
                // Check for attachments - include both attachmentId and inline attachments
                if (part.filename && part.filename.length > 0) {
                  const attachmentId = part.body?.attachmentId;
                  if (attachmentId) {
                    // Get Content-ID header for inline images
                    const contentIdHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
                    const contentDisposition = part.headers?.find(h => h.name.toLowerCase() === 'content-disposition');
                    const contentId = contentIdHeader?.value?.replace(/[<>]/g, ''); // Remove < > brackets
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
                    
                    console.log(`Found attachment: ${part.filename}, ID: ${attachmentId}, ContentID: ${contentId || 'none'}, Inline: ${isInline}`);
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

          // Store attachment metadata (without downloading content to avoid timeouts)
          // CRITICAL: Include all fields needed for download and inline rendering
          const processedAttachments = attachments.map(att => ({
            filename: att.filename,
            mime_type: att.mime_type,
            size: att.size,
            attachment_id: att.attachment_id,
            gmail_message_id: att.gmail_message_id,
            content_id: att.content_id || null,
            is_inline: att.is_inline || false
          }));
          
          console.log(`Message ${message.id}: Subject="${subject}", Attachments=${processedAttachments.length}`);
          if (processedAttachments.length > 0) {
            console.log('Attachment details:', JSON.stringify(processedAttachments));
          }

          // Parse addresses safely
          const toAddresses = to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [];
          const fromAddress = parseEmailAddress(from) || 'unknown@unknown.com';
          
          // Determine if outbound by checking if from address matches user's email
          const userEmail = user.gmail_email || user.email;
          const isOutbound = message.isOutbound || 
            fromAddress.toLowerCase() === userEmail.toLowerCase() ||
            detail.labelIds?.includes('SENT');

          // Create message - use Base44 thread ID (not Gmail thread ID)
          const messageData = {
            thread_id: threadId, // This is the Base44 entity ID
            gmail_message_id: message.id,
            from_address: fromAddress,
            to_addresses: toAddresses.length > 0 ? toAddresses : [fromAddress],
            sent_at: new Date(date).toISOString(),
            subject: subject || '(No Subject)',
            body_html: bodyHtml,
            body_text: bodyText,
            message_id: effectiveMessageId,
            is_outbound: isOutbound,
            attachments: processedAttachments.length > 0 ? processedAttachments : undefined
          };
          
          if (inReplyTo) {
            messageData.in_reply_to = inReplyTo;
          }
          
          console.log(`Creating message for thread ${threadId}, gmail_message_id: ${message.id}`);
          try {
            const createdMessage = await base44.asServiceRole.entities.EmailMessage.create(messageData);
            console.log(`>>> MESSAGE CREATED: ${createdMessage.id}`);
          } catch (createError) {
            console.error(`>>> FAILED TO CREATE MESSAGE: ${createError.message}`);
            throw createError;
          }
          
          // Update thread message count and auto-save attachments if linked
          try {
            const currentThread = await base44.asServiceRole.entities.EmailThread.get(threadId);
            await base44.asServiceRole.entities.EmailThread.update(threadId, {
              message_count: (currentThread.message_count || 0) + 1
            });

            // Auto-save attachments if thread is linked to Project or Job
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
            console.log('Error updating thread or auto-saving:', e.message);
          }

          return true; // Synced
        }
      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError.message);
        return false;
      }
    }

    // Process with concurrency
    const CONCURRENCY = 3;
    const queue = allMessages.slice(0, 60); // Process up to 60 messages
    const results = [];
    
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      const chunk = queue.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(m => processMessage(m)));
      results.push(...chunkResults);
    }
    
    syncedCount = results.filter(Boolean).length;

    console.log(`=== Gmail Sync Complete: ${syncedCount} synced of ${queue.length} processed ===`);
    return Response.json({ synced: syncedCount, total: queue.length });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return Response.json({ 
      error: error.message || 'Sync failed', 
      synced: 0 
    }, { status: 200 }); // Return 200 to prevent breaking the UI
  }
});