import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshTokenIfNeeded(base44, user) {
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const { project_id } = await req.json();
    
    if (!project_id) {
      return Response.json({ error: 'project_id required' }, { status: 400 });
    }
    
    // Get all email threads for this project
    const threads = await base44.asServiceRole.entities.EmailThread.filter({ project_id });
    
    if (!threads || threads.length === 0) {
      return Response.json({ message: 'No email threads found for this project' });
    }
    
    const accessToken = await refreshTokenIfNeeded(base44, user);
    let updatedCount = 0;
    
    // Process each thread
    for (const thread of threads) {
      const messages = await base44.asServiceRole.entities.EmailMessage.filter({ thread_id: thread.id });
      
      for (const message of messages) {
        // Skip if already has attachments
        if (message.attachments && message.attachments.length > 0) {
          console.log(`Message ${message.id} already has attachments`);
          continue;
        }
        
        // Fetch full message from Gmail
        try {
          const gmailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.gmail_message_id}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          
          if (!gmailResponse.ok) {
            console.error(`Failed to fetch Gmail message ${message.gmail_message_id}`);
            continue;
          }
          
          const gmailMessage = await gmailResponse.json();
          const attachments = [];
          
          // Extract attachments from message parts
          const processParts = (parts) => {
            for (const part of parts || []) {
              if (part.filename && part.body?.attachmentId) {
                attachments.push({
                  filename: part.filename,
                  attachmentId: part.body.attachmentId,
                  mimeType: part.mimeType,
                  size: part.body.size
                });
              }
              if (part.parts) {
                processParts(part.parts);
              }
            }
          };
          
          processParts(gmailMessage.payload?.parts);
          
          if (attachments.length === 0) {
            continue;
          }
          
          // Download and upload each attachment
          const uploadedAttachments = [];
          for (const att of attachments) {
            try {
              // Fetch attachment data
              const attResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.gmail_message_id}/attachments/${att.attachmentId}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
              );
              
              if (!attResponse.ok) {
                console.error(`Failed to fetch attachment ${att.filename}`);
                continue;
              }
              
              const attData = await attResponse.json();
              
              // Convert base64url to base64
              const base64Data = attData.data.replace(/-/g, '+').replace(/_/g, '/');
              
              // Convert to blob
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: att.mimeType });
              const file = new File([blob], att.filename, { type: att.mimeType });
              
              // Upload to storage
              const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
              
              uploadedAttachments.push({
                filename: att.filename,
                url: file_url,
                size: att.size,
                mime_type: att.mimeType
              });
            } catch (err) {
              console.error(`Error processing attachment ${att.filename}:`, err);
            }
          }
          
          // Update message with attachments
          if (uploadedAttachments.length > 0) {
            await base44.asServiceRole.entities.EmailMessage.update(message.id, {
              attachments: uploadedAttachments
            });
            updatedCount++;
            console.log(`Updated message ${message.id} with ${uploadedAttachments.length} attachments`);
          }
        } catch (err) {
          console.error(`Error processing message ${message.id}:`, err);
        }
      }
    }
    
    return Response.json({ 
      success: true, 
      message: `Updated ${updatedCount} messages with attachments`,
      threads_processed: threads.length
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});