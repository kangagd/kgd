import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
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

    // Fetch thread from Gmail
    const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmail_thread_id}`;
    const response = await fetch(threadUrl, {
      headers: {
        'Authorization': `Bearer ${user.gmail_access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Gmail API error: ${error}` }, { status: response.status });
    }

    const gmailThreadData = await response.json();
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

    // Auto-link to customer and project (same logic as gmailSync)
    try {
      const allEmails = [fromAddress, ...toAddresses].map(e => e.toLowerCase());
      const customers = await base44.asServiceRole.entities.Customer.list();
      const matchingCustomer = customers.find(c => 
        c.email && allEmails.includes(c.email.toLowerCase())
      );
      
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

    // Create new thread or update existing (if force re-sync)
    let thread;
    if (existing.length > 0 && force) {
      await base44.asServiceRole.entities.EmailThread.update(existing[0].id, emailThreadData);
      thread = existing[0];
    } else {
      thread = await base44.asServiceRole.entities.EmailThread.create(emailThreadData);
    }

    // Create EmailMessage records
    for (const msg of messages) {
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

      await base44.asServiceRole.entities.EmailMessage.create({
        thread_id: thread.id,
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
    }

    return Response.json({ thread_id: thread.id, synced: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});