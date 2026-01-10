import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { updateProjectActivity } from './updateProjectActivity.js';
import { gmailDwdFetch } from './shared/gmailDwdClient.js';

function createMimeMessage(to, subject, body, cc, bcc, inReplyTo, references, attachments) {
  const boundary = `boundary_${Date.now()}`;
  let message = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];
  
  if (cc) message.push(`Cc: ${cc}`);
  if (bcc) message.push(`Bcc: ${bcc}`);
  
  // Fix MIME headers for proper Gmail threading
  if (inReplyTo) {
    message.push(`In-Reply-To: ${inReplyTo}`);
    message.push(`References: ${references ? `${references} ${inReplyTo}` : inReplyTo}`);
  }
  
  message.push(`MIME-Version: 1.0`);
  message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  message.push('');
  message.push(`--${boundary}`);
  message.push('Content-Type: text/html; charset=UTF-8');
  message.push('');
  message.push(body);
  
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      message.push(`--${boundary}`);
      message.push(`Content-Type: ${attachment.mimeType || 'application/octet-stream'}; name="${attachment.filename}"`);
      message.push('Content-Transfer-Encoding: base64');
      message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      message.push('');
      message.push(attachment.data);
    }
  }
  
  message.push(`--${boundary}--`);
  
  return btoa(unescape(encodeURIComponent(message.join('\r\n'))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and manager can send emails (technicians require explicit permission)
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json({ error: 'Forbidden: Only admin and managers can send emails' }, { status: 403 });
    }
    
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { 
      to, cc, bcc, subject, body_html, 
      gmail_thread_id, 
      in_reply_to, references, 
      project_id, job_id,
      attachments
    } = requestBody;
    
    console.log('Request payload:', { to, subject, body_html: body_html ? 'present' : 'missing' });
    
    if (!to || !subject || !body_html) {
      console.error('Missing required fields:', { to: !!to, subject: !!subject, body_html: !!body_html });
      return Response.json({ error: 'Missing required fields: to, subject, body_html' }, { status: 400 });
    }
    
    // Enforce reply safety check
    if (gmail_thread_id && !in_reply_to) {
      return Response.json(
        { error: 'Reply requires RFC Message-ID (in_reply_to)' },
        { status: 400 }
      );
    }
    
    const encodedMessage = createMimeMessage(to, subject, body_html, cc, bcc, in_reply_to, references, attachments);
    
    const sendBody = { raw: encodedMessage };
    if (gmail_thread_id) {
      sendBody.threadId = gmail_thread_id;
    }
    
    const result = await gmailDwdFetch('/gmail/v1/users/me/messages/send', 'POST', sendBody);
    
    // Upload attachments and get URLs for storage
    const uploadedAttachments = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        try {
          // Convert base64 back to file blob for upload
          const binaryString = atob(att.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: att.mimeType });
          const file = new File([blob], att.filename, { type: att.mimeType });
          
          // Upload file and get URL
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          uploadedAttachments.push({
            filename: att.filename,
            url: file_url,
            size: att.size,
            mime_type: att.mimeType
          });
        } catch (err) {
          console.error(`Failed to upload attachment ${att.filename}:`, err);
        }
      }
    }
    
    // Find or create EmailThread
    let emailThreadId = null;
    
    if (gmail_thread_id) {
      // Find existing thread by Gmail thread ID
      const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id: gmail_thread_id
      });
      
      if (existingThreads.length > 0) {
        emailThreadId = existingThreads[0].id;
        
        // Update thread metadata
        const updates = {
          last_message_date: new Date().toISOString(),
          last_message_snippet: body_html.replace(/<[^>]*>/g, '').substring(0, 100),
          message_count: (existingThreads[0].message_count || 0) + 1,
          is_read: true
        };
        
        // Update project linkage if provided
        if (project_id) {
          const projectData = await base44.asServiceRole.entities.Project.get(project_id);
          updates.project_id = project_id;
          updates.project_number = projectData?.project_number || null;
          updates.project_title = projectData?.title || null;
          updates.customer_id = projectData?.customer_id || null;
          updates.customer_name = projectData?.customer_name || null;
        }
        
        await base44.asServiceRole.entities.EmailThread.update(emailThreadId, updates);
      }
    }
    
    // Create new thread if not found
    if (!emailThreadId) {
      const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        subject: subject,
        gmail_thread_id: result.threadId,
        from_address: impersonateEmail,
        to_addresses: to.split(',').map(e => e.trim()),
        last_message_date: new Date().toISOString(),
        last_message_snippet: body_html.replace(/<[^>]*>/g, '').substring(0, 100),
        status: 'Closed',
        priority: 'Normal',
        is_read: true,
        message_count: 1,
        project_id: project_id || null,
        linked_job_id: job_id || null
      });
      emailThreadId = newThread.id;
    }
    
    // Fetch the sent message to get its proper Message-ID header
    const sentMessageData = await gmailDwdFetch(
      `/gmail/v1/users/me/messages/${result.id}`,
      'GET',
      null,
      { format: 'metadata', metadataHeaders: 'Message-ID' }
    );
    
    let rfcMessageId = result.id;
    if (sentMessageData?.payload?.headers) {
      const messageIdHeader = sentMessageData.payload.headers.find(h => h.name === 'Message-ID');
      if (messageIdHeader?.value) {
        rfcMessageId = messageIdHeader.value;
      }
    }

    // Store sent message with audit fields
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
    
    await base44.asServiceRole.entities.EmailMessage.create({
      thread_id: emailThreadId,
      gmail_message_id: result.id,
      message_id: rfcMessageId,
      from_address: impersonateEmail,
      from_name: user.display_name || user.full_name,
      to_addresses: to.split(',').map(e => e.trim()),
      cc_addresses: cc ? cc.split(',').map(e => e.trim()) : [],
      bcc_addresses: bcc ? bcc.split(',').map(e => e.trim()) : [],
      subject: subject,
      body_html: body_html,
      is_outbound: true,
      sent_at: new Date().toISOString(),
      in_reply_to: in_reply_to || null,
      references: references || null,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : [],
      // Audit fields
      sent_by_user_id: user.id,
      sent_by_user_email: user.email
    });
    
    // Mark thread as closed after sending reply
    if (emailThreadId) {
      await base44.asServiceRole.entities.EmailThread.update(emailThreadId, { status: 'Closed' });
    }
    
    // Update project activity if linked
    if (project_id) {
      const activityType = gmail_thread_id ? 'Email Reply Sent' : 'Email Sent';
      await updateProjectActivity(base44, project_id, activityType);
      
      // Update project last contact timestamps
      base44.functions.invoke('updateProjectLastContactFromThread', {
        email_thread_id: emailThreadId
      }).catch(err => console.error('Update project contact failed:', err));
    }
    
    return Response.json({ 
      success: true, 
      messageId: result.id, 
      threadId: emailThreadId,
      gmail_thread_id: result.threadId
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});