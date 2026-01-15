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

// Helper to retry Gmail API calls with exponential backoff (429/503 only)
async function fetchWithRetry(url, options, maxRetries = 3) {
  const delays = [200, 500, 1200];
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 404 is non-fatal - return as-is
      if (response.status === 404) {
        return response;
      }
      
      // Retry on 429 (rate limit) and 503 (service unavailable)
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries - 1) {
        const delay = delays[attempt];
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Helper to check if document already exists (by URL or metadata)
function isDocumentAlreadyExists(newUrl, newGmailMessageId, newAttachmentId, existingDocs) {
  return existingDocs.some(doc => {
    const docUrl = typeof doc === 'string' ? doc : doc.url;
    
    // Exact URL match
    if (docUrl === newUrl) return true;
    
    // Metadata match for object-based docs
    if (typeof doc === 'object' && doc.source) {
      if (doc.source.gmail_message_id === newGmailMessageId && 
          doc.source.attachment_id === newAttachmentId) {
        return true;
      }
    }
    
    return false;
  });
}

// Helper to check if image already exists (by exact URL only)
function isImageAlreadyExists(newUrl, existingImages) {
  return existingImages.some(url => url === newUrl);
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
      return Response.json({ message: 'No email threads linked to projects', saved: 0, skipped: 0, processed: 0 });
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
    let totalSkipped = 0;
    let totalProcessed = 0;
    const errors = [];
    const projectsUpdated = new Set();
    const maxAttachmentsToProcess = 100;
    let attachmentCount = 0;

    // Process each thread
    for (const thread of threads) {
      const projectId = thread.project_id;
      if (!projectId) continue;
      
      try {
        // Get all messages for this thread
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        });

        // Process each message's attachments
        for (const message of messages) {
          if (attachmentCount >= maxAttachmentsToProcess) {
            console.log(`Reached attachment processing limit (${maxAttachmentsToProcess})`);
            break;
          }
          
          if (!message.attachments || message.attachments.length === 0) continue;

          // Filter out inline images and logos
          const realAttachments = message.attachments.filter(att => 
            !isLikelyLogoOrInlineImage(att) && 
            att.attachment_id && 
            (message.gmail_message_id || att.gmail_message_id)
          );

          for (const attachment of realAttachments) {
            if (attachmentCount >= maxAttachmentsToProcess) break;
            
            try {
              const effectiveGmailMessageId = attachment.gmail_message_id || message.gmail_message_id;
              
              // Validate required fields before Gmail fetch
              if (!effectiveGmailMessageId) {
                console.warn(`Skipping ${attachment.filename}: missing gmail_message_id`);
                totalSkipped++;
                continue;
              }
              
              if (!attachment.attachment_id) {
                console.warn(`Skipping ${attachment.filename}: missing attachment_id`);
                totalSkipped++;
                continue;
              }
              
              if (!attachment.filename) {
                console.warn(`Skipping attachment: missing filename`);
                totalSkipped++;
                continue;
              }

              attachmentCount++;
              totalProcessed++;

              // Refetch project to get latest state
              const freshProject = await base44.asServiceRole.entities.Project.get(projectId);
              const existingImages = freshProject.image_urls || [];
              const existingDocs = freshProject.other_documents || [];
              
              // Fetch attachment from Gmail with retry logic
              const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${effectiveGmailMessageId}/attachments/${attachment.attachment_id}`;
              const attachmentResponse = await fetchWithRetry(gmailUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });

              // Handle 404 gracefully
              if (attachmentResponse.status === 404) {
                console.warn(`Skipping ${attachment.filename}: not found in Gmail`);
                totalSkipped++;
                continue;
              }

              if (!attachmentResponse.ok) {
                throw new Error(`Gmail API error: ${attachmentResponse.statusText}`);
              }

              const attachmentData = await attachmentResponse.json();
              
              if (!attachmentData.data) {
                throw new Error('No attachment data returned from Gmail');
              }
              
              const fileData = Uint8Array.from(atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
              
              // Upload to storage using File object (not blob)
              const file = new File([fileData], attachment.filename, { 
                type: attachment.mime_type || 'application/octet-stream' 
              });

              const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
              
              if (!uploadResult.file_url) {
                throw new Error('Upload failed - no URL returned');
              }

              // Categorize and save to project with deduplication
              const isImage = attachment.mime_type?.startsWith('image/');
              
              if (isImage) {
                // Images: dedupe by exact URL only
                if (isImageAlreadyExists(uploadResult.file_url, existingImages)) {
                  console.log(`Skipping ${attachment.filename}: image URL already exists`);
                  totalSkipped++;
                  continue;
                }
                
                const updatedImages = [...existingImages, uploadResult.file_url];
                await base44.asServiceRole.entities.Project.update(projectId, { 
                  image_urls: updatedImages 
                });
              } else {
                // Documents: dedupe by URL and metadata
                if (isDocumentAlreadyExists(uploadResult.file_url, effectiveGmailMessageId, attachment.attachment_id, existingDocs)) {
                  console.log(`Skipping ${attachment.filename}: document already exists`);
                  totalSkipped++;
                  continue;
                }
                
                const newDoc = {
                  url: uploadResult.file_url, 
                  name: attachment.filename,
                  source: {
                    gmail_message_id: effectiveGmailMessageId,
                    attachment_id: attachment.attachment_id
                  }
                };
                
                const updatedDocs = [...existingDocs, newDoc];
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
          
          if (attachmentCount >= maxAttachmentsToProcess) break;
        }
      } catch (threadError) {
        console.error(`Error processing thread ${thread.id}:`, threadError);
        errors.push({ thread: thread.id, error: threadError.message });
      }
    }

    const remainingEstimate = attachmentCount >= maxAttachmentsToProcess ? 'run function again' : undefined;

    return Response.json({ 
      success: true,
      saved: totalSaved,
      skipped: totalSkipped,
      processed: totalProcessed,
      projects_updated: projectsUpdated.size,
      threads_processed: threads.length,
      remainingEstimate,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${totalProcessed} attachment${totalProcessed !== 1 ? 's' : ''}, saved ${totalSaved}, skipped ${totalSkipped} across ${projectsUpdated.size} project${projectsUpdated.size !== 1 ? 's' : ''}`
    });

  } catch (error) {
    console.error('Resync attachments error:', error);
    return Response.json({ 
      error: error.message || 'Failed to resync attachments',
      details: error.stack
    }, { status: 500 });
  }
});