import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmail_thread_id, force = false } = await req.json();

    if (!gmail_thread_id) {
      return Response.json({ error: 'Thread ID required' }, { status: 400 });
    }

    // Check if already synced (skip if force=true)
    const existing = await base44.entities.EmailThread.filter({ gmail_thread_id });
    if (existing.length > 0 && !force) {
      return Response.json({ thread_id: existing[0].id, already_synced: true });
    }

    // If force re-sync, delete entire thread (cascades to messages)
    if (existing.length > 0 && force) {
      await base44.asServiceRole.entities.EmailThread.delete(existing[0].id);
    }

    // Fetch thread from Gmail using shared service account
    const gmailThreadData = await gmailFetch(`/gmail/v1/users/me/threads/${gmail_thread_id}`, 'GET');
    const messages = gmailThreadData.messages || [];

    if (messages.length === 0) {
      return Response.json({ error: 'No messages found in thread' }, { status: 404 });
    }

    // Get thread-level info from first message
    const firstMsg = messages[0];
    const headers = firstMsg.payload?.headers || [];
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    const fromMatch = from.match(/<(.+?)>/);
    const fromAddress = fromMatch ? fromMatch[1] : from;
    const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
    const toAddresses = toHeader.split(',').map(addr => {
      const match = addr.trim().match(/<(.+?)>/);
      return match ? match[1] : addr.trim();
    }).filter(Boolean);

    // Create EmailThread with initial data
    const emailThreadData = {
      subject,
      gmail_thread_id,
      last_message_snippet: firstMsg.snippet || '',
      last_message_date: new Date(parseInt(firstMsg.internalDate)).toISOString(),
      from_address: fromAddress,
      to_addresses: toAddresses,
      status: 'Open',
      priority: 'Normal',
      message_count: messages.length,
      is_read: false
    };

    // Auto-link to customer and project
    try {
      const allEmails = [fromAddress, ...toAddresses].map(e => e.toLowerCase());
      const customers = await base44.asServiceRole.entities.Customer.filter({});
      const matchingCustomer = customers.find(c => 
        c.email && allEmails.includes(c.email.toLowerCase())
      ) || null;
      
      if (matchingCustomer) {
        emailThreadData.customer_id = matchingCustomer.id;
        emailThreadData.customer_name = matchingCustomer.name;
        
        // Find most recent open project for this customer
        const projects = await base44.asServiceRole.entities.Project.filter({
          customer_id: matchingCustomer.id
        });
        
        const openProjects = projects.filter(p => 
          !['Completed', 'Lost', 'Cancelled'].includes(p.status)
        ).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        
        if (openProjects.length > 0) {
          emailThreadData.project_id = openProjects[0].id;
          emailThreadData.project_number = openProjects[0].project_number;
          emailThreadData.project_title = openProjects[0].title;
          emailThreadData.linked_to_project_at = new Date().toISOString();
          emailThreadData.linked_to_project_by = 'system';
        }
      }
    } catch (linkError) {
      console.error('Auto-link error:', linkError.message);
      // Continue with minimal data if linking fails
    }

    // Create EmailMessage records first
    const createdMessages = [];
    for (const msg of messages) {
      try {
        const msgHeaders = msg.payload?.headers || [];
        const msgFrom = msgHeaders.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const msgFromMatch = msgFrom.match(/<(.+?)>/);
        const msgFromAddress = msgFromMatch ? msgFromMatch[1] : msgFrom;
        const msgTo = msgHeaders.find(h => h.name.toLowerCase() === 'to')?.value || '';
        const msgToAddresses = msgTo.split(',').map(addr => {
          const match = addr.trim().match(/<(.+?)>/);
          return match ? match[1] : addr.trim();
        }).filter(Boolean);

        const sentDate = new Date(parseInt(msg.internalDate)).toISOString();

        // Extract body
        let bodyText = '';
        let bodyHtml = '';
        
        if (msg.payload?.body?.data) {
          bodyText = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (msg.payload?.parts) {
          for (const part of msg.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              bodyHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
          }
        }

        createdMessages.push({
          gmail_message_id: msg.id,
          from_address: msgFromAddress,
          from_name: msgFrom.replace(/<.+?>/, '').trim() || msgFromAddress,
          to_addresses: msgToAddresses,
          sent_at: sentDate,
          subject,
          body_text: bodyText,
          body_html: bodyHtml,
          is_outbound: msgFromAddress.toLowerCase() === (user.gmail_email || user.email).toLowerCase()
        });
      } catch (msgError) {
        console.error(`Error processing message ${msg.id}:`, msgError.message);
      }
    }

    // Only create thread if we have at least one message
    if (createdMessages.length === 0) {
      return Response.json({ error: 'Failed to process any messages from thread' }, { status: 400 });
    }

    // Create thread only after confirming messages can be processed
    const thread = await base44.asServiceRole.entities.EmailThread.create(emailThreadData);

    // Now insert the pre-processed messages
    for (const msgData of createdMessages) {
      await base44.asServiceRole.entities.EmailMessage.create({
        thread_id: thread.id,
        ...msgData
      });
    }

    return Response.json({ thread_id: thread.id, synced: true });
  } catch (error) {
   console.error('Sync error:', error);
   return Response.json({ error: error.message }, { status: 500 });
  }
});