import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailDwdFetch } from './shared/gmailDwdClient.js';

// Create MIME message
function createMimeMessage(to, subject, body, cc, bcc, inReplyTo, references) {
  const boundary = `boundary_${Date.now()}`;
  let message = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];
  
  if (cc) message.push(`Cc: ${cc}`);
  if (bcc) message.push(`Bcc: ${bcc}`);
  if (inReplyTo) {
    message.push(`In-Reply-To: ${inReplyTo}`);
    message.push(`References: ${references ? `${references} ${inReplyTo}` : inReplyTo}`);
  }
  
  message.push(`MIME-Version: 1.0`);
  message.push(`Content-Type: text/html; charset=UTF-8`);
  message.push('');
  message.push(body);
  
  const raw = message.join('\r\n');
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    // Parse request (handle Base44 SDK wrapper)
    const rawBody = await req.json();
    const body = rawBody.data || rawBody;
    const { to, cc, bcc, subject, body_html, gmail_thread_id, in_reply_to, references } = body;

    console.log('Send request:', { to, subject, has_body: !!body_html });

    // Validate
    if (!to || !subject || !body_html) {
      return Response.json({ 
        error: 'Missing required fields: to, subject, body_html' 
      }, { status: 400 });
    }

    // Auth
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.extended_role !== 'manager')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create MIME message
    const encodedMessage = createMimeMessage(to, subject, body_html, cc, bcc, in_reply_to, references);

    // Send via Gmail API
    const sendPayload = { raw: encodedMessage };
    if (gmail_thread_id) {
      sendPayload.threadId = gmail_thread_id;
    }

    const result = await gmailDwdFetch('/messages/send', 'POST', sendPayload);

    // Find or create EmailThread
    let threadId = null;
    
    if (gmail_thread_id) {
      const existing = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id
      });
      
      if (existing.length > 0) {
        threadId = existing[0].id;
        await base44.asServiceRole.entities.EmailThread.update(threadId, {
          last_message_date: new Date().toISOString(),
          message_count: (existing[0].message_count || 0) + 1,
          status: 'Closed'
        });
      }
    }

    if (!threadId) {
      const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        subject,
        gmail_thread_id: result.threadId,
        from_address: impersonateEmail,
        to_addresses: to.split(',').map(e => e.trim()),
        last_message_date: new Date().toISOString(),
        last_message_snippet: body_html.replace(/<[^>]*>/g, '').substring(0, 100),
        status: 'Closed',
        priority: 'Normal',
        is_read: true,
        message_count: 1
      });
      threadId = newThread.id;
    }

    // Store message
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
    await base44.asServiceRole.entities.EmailMessage.create({
      thread_id: threadId,
      gmail_message_id: result.id,
      from_address: impersonateEmail,
      from_name: user.display_name || user.full_name,
      to_addresses: to.split(',').map(e => e.trim()),
      cc_addresses: cc ? cc.split(',').map(e => e.trim()) : [],
      bcc_addresses: bcc ? bcc.split(',').map(e => e.trim()) : [],
      subject,
      body_html,
      is_outbound: true,
      sent_at: new Date().toISOString(),
      sent_by_user_email: user.email
    });

    return Response.json({ 
      success: true, 
      messageId: result.id,
      threadId
    });
  } catch (error) {
    console.error('Send error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});