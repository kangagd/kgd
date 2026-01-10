import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailDwdFetch } from './shared/gmailDwdClient.js';

// Sync emails from shared inbox
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.extended_role !== 'manager')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch threads from Gmail (last 50)
    const threadsData = await gmailDwdFetch('/threads', 'GET', null, { 
      maxResults: 50,
      q: '-in:spam -in:trash'
    });

    const threads = threadsData.threads || [];
    let syncedCount = 0;
    let skippedCount = 0;

    for (const thread of threads) {
      // Check if thread already exists
      const existing = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id: thread.id
      });

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      // Fetch full thread details
      const fullThread = await gmailDwdFetch(`/threads/${thread.id}`, 'GET', null, {
        format: 'full'
      });

      const messages = fullThread.messages || [];
      if (messages.length === 0) continue;

      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];

      // Parse headers
      const getHeader = (msg, name) => {
        const header = msg.payload?.headers?.find(h => h.name === name);
        return header?.value || '';
      };

      const subject = getHeader(firstMessage, 'Subject') || '(No subject)';
      const from = getHeader(lastMessage, 'From');
      const to = getHeader(lastMessage, 'To');
      
      // Extract snippet
      const snippet = lastMessage.snippet || '';

      // Create thread
      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        gmail_thread_id: thread.id,
        subject,
        from_address: from.match(/<(.+)>/)?.[1] || from,
        to_addresses: to.split(',').map(e => e.trim()),
        last_message_date: new Date(parseInt(lastMessage.internalDate)).toISOString(),
        last_message_snippet: snippet,
        status: 'Open',
        priority: 'Normal',
        is_read: false,
        message_count: messages.length
      });

      // Store messages
      for (const msg of messages) {
        const messageFrom = getHeader(msg, 'From');
        const messageTo = getHeader(msg, 'To');
        const messageSubject = getHeader(msg, 'Subject');
        const messageId = getHeader(msg, 'Message-ID');
        const inReplyTo = getHeader(msg, 'In-Reply-To');
        const references = getHeader(msg, 'References');

        // Extract body
        let bodyHtml = '';
        let bodyText = '';
        
        if (msg.payload?.body?.data) {
          bodyText = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (msg.payload?.parts) {
          for (const part of msg.payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              bodyHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
          }
        }

        await base44.asServiceRole.entities.EmailMessage.create({
          thread_id: newThread.id,
          gmail_message_id: msg.id,
          message_id: messageId,
          from_address: messageFrom.match(/<(.+)>/)?.[1] || messageFrom,
          from_name: messageFrom.replace(/<.+>/, '').trim(),
          to_addresses: messageTo.split(',').map(e => e.trim()),
          subject: messageSubject,
          body_html: bodyHtml || bodyText.replace(/\n/g, '<br>'),
          body_text: bodyText,
          sent_at: new Date(parseInt(msg.internalDate)).toISOString(),
          in_reply_to: inReplyTo,
          references: references,
          is_outbound: false
        });
      }

      syncedCount++;
    }

    return Response.json({
      success: true,
      synced: syncedCount,
      skipped: skippedCount,
      total: threads.length
    });
  } catch (error) {
    console.error('Gmail sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});