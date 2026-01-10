import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

async function refreshTokenIfNeeded(base44, user) {
  // If no token expiry set or token is expired/close to expiring
  const expiryTime = user.gmail_token_expiry ? new Date(user.gmail_token_expiry).getTime() : 0;
  const now = Date.now();
  
  if (!user.gmail_refresh_token) {
    throw new Error('Gmail refresh token not found. Please reconnect Gmail.');
  }
  
  if (expiryTime - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Gmail credentials not configured');
    }
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: user.gmail_refresh_token,
        grant_type: 'refresh_token'
      })
    });
    
    const tokens = await response.json();
    
    if (!response.ok || tokens.error) {
      throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error || 'Unknown error'}`);
    }
    
    await base44.auth.updateMe({
      gmail_access_token: tokens.access_token,
      gmail_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    return tokens.access_token;
  }
  
  return user.gmail_access_token;
}

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
    
    // CRITICAL: Authenticate user first - any authenticated user can send emails
    let currentUser;
    try {
      currentUser = await base44.auth.me();
    } catch (authError) {
      console.error('[gmailSendEmail] Authentication error:', authError);
      return Response.json({ error: 'User not authenticated', details: authError.message }, { status: 401 });
    }
    
    if (!currentUser) {
      console.error('[gmailSendEmail] User authentication failed - currentUser is null');
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    console.log(`[gmailSendEmail] ✅ Authenticated user: ${currentUser.email}, role: ${currentUser.role}, extended_role: ${currentUser.extended_role}`);
    
    // CRITICAL: Use current user's Gmail connection if they have one, otherwise find shared account
    let user = currentUser;
    
    if (!currentUser.gmail_access_token || !currentUser.gmail_refresh_token) {
      console.log(`[gmailSendEmail] User ${currentUser.email} doesn't have Gmail connected, checking for shared account...`);
      
      // Try to find any user with Gmail connected (requires service role for admin/shared accounts)
      try {
        const allUsers = await base44.asServiceRole.entities.User.list();
        const connectedUser = allUsers.find(u => u.gmail_access_token && u.gmail_refresh_token);
        
        if (!connectedUser) {
          console.error('[gmailSendEmail] No Gmail connection found in system');
          return Response.json({ error: 'Gmail not connected. Please connect your Gmail account or ask an admin to set up a shared Gmail connection.' }, { status: 400 });
        }
        
        user = connectedUser;
        console.log(`[gmailSendEmail] Using shared Gmail connection from: ${user.email}`);
      } catch (listError) {
        console.error('[gmailSendEmail] Failed to list users for shared connection:', listError);
        return Response.json({ error: 'Gmail not connected. Please connect your Gmail account.' }, { status: 400 });
      }
    } else {
      console.log(`[gmailSendEmail] Using user's own Gmail connection: ${currentUser.email}`);
    }
    
    // UPDATED CONTRACT: Accept both base44_thread_id and gmail_thread_id
    const { 
      to, cc, bcc, subject, body, 
      base44_thread_id, gmail_thread_id, 
      inReplyTo, references, 
      attachments, projectId, jobId 
    } = await req.json();
    
    // Debug: Log attachments to verify they're received
    console.log('Received attachments:', attachments ? attachments.length : 0, attachments);
    
    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Enforce reply safety check
    if (gmail_thread_id && !inReplyTo) {
      return Response.json(
        { error: 'Reply requires RFC Message-ID (inReplyTo)' },
        { status: 400 }
      );
    }
    
    const accessToken = await refreshTokenIfNeeded(base44, user);
    
    const encodedMessage = createMimeMessage(to, subject, body, cc, bcc, inReplyTo, references, attachments);
    
    // Use gmail_thread_id for Gmail API call if provided
    const sendUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
    
    const sendBody = { raw: encodedMessage };
    if (gmail_thread_id) sendBody.threadId = gmail_thread_id;
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${error}`);
    }
    
    const result = await response.json();
    
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
    
    // C) Persist reply under the SAME EmailThread (use base44_thread_id)
    let emailThreadId = base44_thread_id;
    
    if (!emailThreadId) {
      // Try to find existing thread by subject + participants (same logic as gmailSync)
      const normalizedSubject = subject.replace(/^(Re:|Fwd?:|Fw:)\s*/gi, '').trim().toLowerCase();
      const toAddrs = to.split(',').map(e => e.trim().toLowerCase());
      const ccAddrs = cc ? cc.split(',').map(e => e.trim().toLowerCase()) : [];
      const fromAddr = (user.gmail_email || user.email).toLowerCase();
      
      const allThreads = await base44.asServiceRole.entities.EmailThread.list();
      const matchingThreads = allThreads.filter(t => {
        const threadSubject = (t.subject || '').replace(/^(Re:|Fwd?:|Fw:)\s*/gi, '').trim().toLowerCase();
        if (threadSubject !== normalizedSubject) return false;
        
        // Check if participants match
        const threadFromAddr = (t.from_address || '').toLowerCase();
        const threadToAddrs = (t.to_addresses || []).map(a => a.toLowerCase());
        
        const allCurrent = [fromAddr, ...toAddrs, ...ccAddrs];
        const allThread = [threadFromAddr, ...threadToAddrs];
        
        // Check if there's overlap in participants
        return allCurrent.some(addr => allThread.includes(addr));
      });
      
      if (matchingThreads.length > 0) {
        // Use most recently updated thread
        matchingThreads.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
        emailThreadId = matchingThreads[0].id;
      } else {
        // Create new thread for this sent email
        const newThread = await base44.asServiceRole.entities.EmailThread.create({
          subject: subject,
          gmail_thread_id: result.threadId,
          from_address: user.gmail_email || user.email,
          to_addresses: to.split(',').map(e => e.trim()),
          last_message_date: new Date().toISOString(),
          last_message_snippet: body.replace(/<[^>]*>/g, '').substring(0, 100),
          status: 'Closed',
          priority: 'Normal',
          is_read: true,
          message_count: 1,
          project_id: projectId || null,
          linked_job_id: jobId || null
        });
        emailThreadId = newThread.id;
      }
    }
    
    if (emailThreadId) {
      // C) Update existing thread with reply activity
      // CRITICAL: Refetch thread to get latest project_id to avoid race conditions
      const existingThread = await base44.asServiceRole.entities.EmailThread.get(emailThreadId);
      const updates = {
        last_message_date: new Date().toISOString(),
        last_message_snippet: body.replace(/<[^>]*>/g, '').substring(0, 100),
        message_count: (existingThread?.message_count || 0) + 1,
        is_read: true // Mark as read when sending
      };
      
      // D) Priority: explicit projectId > existing thread.project_id
      // This ensures replies from ProjectEmailSection always link correctly
      if (projectId) {
        // Explicit projectId provided - always use it and cache project fields
        const projectData = await base44.asServiceRole.entities.Project.get(projectId);
        updates.project_id = projectId;
        updates.project_number = projectData?.project_number || null;
        updates.project_title = projectData?.title || null;
        updates.customer_id = projectData?.customer_id || null;
        updates.customer_name = projectData?.customer_name || null;
      } else if (existingThread.project_id) {
        // Thread already has a project - preserve it
        updates.project_id = existingThread.project_id;
      }
      
      await base44.asServiceRole.entities.EmailThread.update(emailThreadId, updates);
    }
    
    // Fetch the sent message to get its proper Message-ID header
    const sentMessageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${result.id}?format=metadata&metadataHeaders=Message-ID`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    let gmailMessageId = result.id;
    if (sentMessageResponse.ok) {
      const sentMessageData = await sentMessageResponse.json();
      const messageIdHeader = sentMessageData.payload?.headers?.find(h => h.name === 'Message-ID');
      if (messageIdHeader?.value) {
        gmailMessageId = messageIdHeader.value;
      }
    }

    // C) Store sent message with proper threading metadata (use service role for reliability)
    await base44.asServiceRole.entities.EmailMessage.create({
      thread_id: emailThreadId,
      gmail_message_id: result.id,
      from_address: user.gmail_email || user.email,
      from_name: user.full_name,
      to_addresses: to.split(',').map(e => e.trim()),
      cc_addresses: cc ? cc.split(',').map(e => e.trim()) : [],
      bcc_addresses: bcc ? bcc.split(',').map(e => e.trim()) : [],
      subject: subject,
      body_html: body,
      is_outbound: true,
      sent_at: new Date().toISOString(),
      message_id: gmailMessageId,
      // B) Preserve reply headers for proper threading
      in_reply_to: inReplyTo || null,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : []
    });
    
    // Mark thread as closed after sending reply
    if (emailThreadId) {
      await base44.asServiceRole.entities.EmailThread.update(emailThreadId, { status: 'Closed' });
    }
    
    // Update project activity if email is linked to a project
    // D) Use project_id from thread if not explicitly provided
    const finalProjectId = projectId || (await base44.asServiceRole.entities.EmailThread.get(emailThreadId)).project_id;
    
    if (finalProjectId) {
      // C) Update activity type based on whether this is a reply
      const activityType = base44_thread_id ? 'Email Reply Sent' : 'Email Sent';
      await updateProjectActivity(base44, finalProjectId, activityType);
      
      // Update project last contact timestamps
      base44.functions.invoke('updateProjectLastContactFromThread', {
        email_thread_id: emailThreadId
      }).catch(err => console.error('Update project contact failed:', err));
    }
    
    return Response.json({ success: true, messageId: result.id, threadId: emailThreadId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});