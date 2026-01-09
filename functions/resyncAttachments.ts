import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to refresh access token if expired
async function refreshTokenIfNeeded(user, base44) {
  if (!user.gmail_refresh_token) {
    throw new Error('No refresh token available');
  }

  const tokenExpiry = user.gmail_token_expiry ? new Date(user.gmail_token_expiry) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (!tokenExpiry || tokenExpiry < fiveMinutesFromNow) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('GMAIL_CLIENT_ID'),
        client_secret: Deno.env.get('GMAIL_CLIENT_SECRET'),
        refresh_token: user.gmail_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh Gmail token');
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);

    await base44.asServiceRole.entities.User.update(user.id, {
      gmail_access_token: tokenData.access_token,
      gmail_token_expiry: expiresAt.toISOString()
    });

    return tokenData.access_token;
  }

  return user.gmail_access_token;
}

// Helper to identify and filter out logos/inline images
function isLikelyLogoOrInlineImage(attachment) {
  if (!attachment.filename) return false;
  
  const filename = attachment.filename.toLowerCase();
  const size = attachment.size || 0;
  
  // Small images are likely logos
  if (size < 30000 && (filename.includes('logo') || filename.includes('icon'))) {
    return true;
  }
  
  // Inline images with content_id
  if (attachment.is_inline || attachment.content_id) {
    return true;
  }
  
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user first
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only function
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all email threads that are linked to projects
    const threads = await base44.asServiceRole.entities.EmailThread.filter({ 
      project_id: { $exists: true, $ne: null }
    });

    if (threads.length === 0) {
      return Response.json({ message: 'No email threads linked to projects', saved: 0 });
    }

    console.log(`Found ${threads.length} threads linked to projects`);

    // Find any user with Gmail connection (shared account)
    const allUsers = await base44.asServiceRole.entities.User.list();
    const gmailUser = allUsers.find(u => u.gmail_access_token && u.gmail_refresh_token);
    
    if (!gmailUser) {
      return Response.json({ error: 'Gmail not connected. Please ask an admin to connect Gmail.' }, { status: 401 });
    }

    console.log(`Using Gmail account: ${gmailUser.email}`);
    
    const accessToken = await refreshTokenIfNeeded(gmailUser, base44);
    
    let totalSaved = 0;
    const errors = [];
    const projectsUpdated = new Set();

    // Process each thread
    for (const thread of threads) {
      const projectId = thread.project_id;
      if (!projectId) continue;
      try {
        // Get project data
        const project = await base44.asServiceRole.entities.Project.get(projectId);
        
        // Get all messages for this thread
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        });

        // Process each message's attachments
        for (const message of messages) {
          if (!message.attachments || message.attachments.length === 0) continue;

          // Filter out inline images and logos
          const realAttachments = message.attachments.filter(att => 
            !isLikelyLogoOrInlineImage(att) && 
            att.attachment_id && 
            (message.gmail_message_id || att.gmail_message_id)
          );

          for (const attachment of realAttachments) {
            try {
              const effectiveGmailMessageId = attachment.gmail_message_id || message.gmail_message_id;
              
              if (!effectiveGmailMessageId || !attachment.attachment_id) {
                console.warn(`Skipping ${attachment.filename}: missing Gmail IDs`);
                continue;
              }

              // Check if already saved
              const existingImages = project.image_urls || [];
              const existingDocs = project.other_documents || [];
              const existingDocUrls = existingDocs.map(doc => typeof doc === 'string' ? doc : doc.url);
              const allUrls = [...existingImages, ...existingDocUrls];
              
              if (allUrls.some(url => url && url.includes(attachment.filename))) {
                console.log(`Skipping ${attachment.filename}: already saved`);
                continue;
              }

              // Fetch attachment from Gmail
              const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${effectiveGmailMessageId}/attachments/${attachment.attachment_id}`;
              const attachmentResponse = await fetch(gmailUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });

              if (!attachmentResponse.ok) {
                throw new Error(`Gmail API error: ${attachmentResponse.statusText}`);
              }

              const attachmentData = await attachmentResponse.json();
              const fileData = Uint8Array.from(atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
              
              // Upload to storage
              const formData = new FormData();
              const blob = new Blob([fileData], { type: attachment.mime_type || 'application/octet-stream' });
              formData.append('file', blob, attachment.filename);

              const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
              
              if (!uploadResult.file_url) {
                throw new Error('Upload failed - no URL returned');
              }

              // Categorize and save to project
              const isImage = attachment.mime_type?.startsWith('image/');
              
              // Refetch project to avoid race conditions
              const freshProject = await base44.asServiceRole.entities.Project.get(projectId);
              
              if (isImage) {
                const updatedImages = [...(freshProject.image_urls || []), uploadResult.file_url];
                await base44.asServiceRole.entities.Project.update(projectId, { 
                  image_urls: updatedImages 
                });
              } else {
                const updatedDocs = [...(freshProject.other_documents || []), { 
                  url: uploadResult.file_url, 
                  name: attachment.filename 
                }];
                await base44.asServiceRole.entities.Project.update(projectId, { 
                  other_documents: updatedDocs 
                });
              }

              totalSaved++;
              projectsUpdated.add(projectId);
              console.log(`Saved: ${attachment.filename} to project ${projectId} as ${isImage ? 'image' : 'document'}`);
              
            } catch (attachmentError) {
              console.error(`Failed to save ${attachment.filename}:`, attachmentError);
              errors.push({ file: attachment.filename, error: attachmentError.message });
            }
          }
        }
      } catch (threadError) {
        console.error(`Error processing thread ${thread.id}:`, threadError);
        errors.push({ thread: thread.id, error: threadError.message });
      }
    }

    return Response.json({ 
      success: true,
      saved: totalSaved,
      projects_updated: projectsUpdated.size,
      threads_processed: threads.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${totalSaved} attachment${totalSaved !== 1 ? 's' : ''} across ${projectsUpdated.size} project${projectsUpdated.size !== 1 ? 's' : ''}`
    });

  } catch (error) {
    console.error('Resync attachments error:', error);
    return Response.json({ 
      error: error.message || 'Failed to resync attachments',
      details: error.stack
    }, { status: 500 });
  }
});