import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshTokenIfNeeded(user, base44) {
  const expiry = user.gmail_token_expiry ? new Date(user.gmail_token_expiry) : new Date(0);
  const now = new Date();
  
  if (expiry - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
    if (!user.gmail_refresh_token) {
      throw new Error('Gmail refresh token not available - please reconnect Gmail');
    }
    
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
    
    if (tokens.error) {
      throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
    }
    
    await base44.asServiceRole.entities.User.update(user.id, {
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
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (users.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    
    const user = users[0];

    if (!user.gmail_access_token) {
      return Response.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    let accessToken;
    try {
      accessToken = await refreshTokenIfNeeded(user, base44);
    } catch (tokenError) {
      console.error('Token refresh error:', tokenError);
      return Response.json({ error: `Token refresh failed: ${tokenError.message}` }, { status: 401 });
    }

    // Get recent email messages (limit to 50 to avoid timeout)
    const allMessages = await base44.asServiceRole.entities.EmailMessage.list('-created_date', 50);
    
    console.log(`Processing ${allMessages.length} most recent messages`);
    
    let updatedCount = 0;
    let checkedCount = 0;
    let skippedCount = 0;

    for (const emailMsg of allMessages) {
      // Skip if message already has gmail_message_id set directly on it
      if (emailMsg.gmail_message_id) {
        skippedCount++;
        continue;
      }

      checkedCount++;
      
      const isTargetMessage = emailMsg.subject?.includes("Quote Request #Brian");
      
      if (isTargetMessage) {
        console.log(`--- Processing target message: ${emailMsg.subject} ---`);
        console.log(`Has message_id: ${!!emailMsg.message_id}`);
      }

      try {
        let gmailMessageId = null;
        
        // Try to find Gmail message using message_id if available
        if (emailMsg.message_id) {
          const searchQuery = encodeURIComponent(`rfc822msgid:${emailMsg.message_id}`);
          const searchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.messages?.length) {
              gmailMessageId = searchData.messages[0].id;
            }
          }
        }
        
        // If no message_id or search failed, try searching by subject and sender
        if (!gmailMessageId) {
          const subject = emailMsg.subject?.replace(/['"<>]/g, '').substring(0, 100);
          const from = emailMsg.from_address;
          const searchQuery = encodeURIComponent(`from:${from} subject:"${subject}"`);
          
          if (isTargetMessage) {
            console.log(`TARGET: Searching by subject/sender: ${searchQuery}`);
          }
          
          const searchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}&maxResults=5`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.messages?.length) {
              gmailMessageId = searchData.messages[0].id;
              if (isTargetMessage) {
                console.log(`TARGET: Found via subject/sender search: ${gmailMessageId}`);
              }
            }
          }
        }
        
        if (!gmailMessageId) {
          if (isTargetMessage) {
            console.log(`TARGET: Could not find Gmail message`);
          }
          continue;
        }

        if (isTargetMessage) {
          console.log(`TARGET: Gmail message ID: ${gmailMessageId}`);
        }

        // Fetch full message details
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!detailResponse.ok) {
          if (isTargetMessage) {
            console.log(`TARGET: Detail fetch failed: ${await detailResponse.text()}`);
          }
          continue;
        }

        const detail = await detailResponse.json();
        
        // Extract message_id from headers if missing
        if (!emailMsg.message_id) {
          const headers = detail.payload?.headers || [];
          const msgIdHeader = headers.find(h => h.name === 'Message-ID');
          if (msgIdHeader) {
            // Update the email message with the message_id
            await base44.asServiceRole.entities.EmailMessage.update(emailMsg.id, {
              message_id: msgIdHeader.value
            });
            if (isTargetMessage) {
              console.log(`TARGET: Updated message_id: ${msgIdHeader.value}`);
            }
          }
        }
        
        if (isTargetMessage) {
          console.log(`TARGET: Payload parts count: ${detail.payload?.parts?.length || 0}`);
        }
        
        // Extract attachments
        const attachments = [];
        
        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            if (isTargetMessage) {
              console.log(`TARGET: Part - mimeType: ${part.mimeType}, filename: ${part.filename || 'none'}, hasAttachmentId: ${!!part.body?.attachmentId}`);
            }
            if (part.filename && part.filename.length > 0) {
              const attachmentId = part.body?.attachmentId;
              if (attachmentId) {
                // Get Content-ID header for inline images
                const contentIdHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
                const contentDisposition = part.headers?.find(h => h.name.toLowerCase() === 'content-disposition');
                const contentId = contentIdHeader?.value?.replace(/[<>]/g, ''); // Remove < > brackets
                const isInline = contentDisposition?.value?.toLowerCase().includes('inline') || !!contentId;
                
                attachments.push({
                  filename: part.filename,
                  mime_type: part.mimeType,
                  size: parseInt(part.body.size) || 0,
                  attachment_id: attachmentId,
                  gmail_message_id: gmailMessageId,
                  content_id: contentId || null,
                  is_inline: isInline
                });
                console.log(`Found attachment: ${part.filename}, ContentID: ${contentId || 'none'}, Inline: ${isInline}`);
              }
            }
            if (part.parts) {
              processParts(part.parts);
            }
          }
        };

        if (detail.payload?.parts) {
          processParts(detail.payload.parts);
        }

        if (isTargetMessage) {
          console.log(`TARGET: Total attachments found: ${attachments.length}`);
        }

        // Always update gmail_message_id on the message itself if we found it
        const updateData = {
          gmail_message_id: gmailMessageId
        };
        
        if (attachments.length > 0) {
          console.log(`Found ${attachments.length} attachments for message: ${emailMsg.subject}`);
          updateData.attachments = attachments;
        }
        
        await base44.asServiceRole.entities.EmailMessage.update(emailMsg.id, updateData);
        updatedCount++;
        console.log(`Updated message ${emailMsg.id} with gmail_message_id: ${gmailMessageId}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`Error processing message ${emailMsg.id}:`, err.message);
        if (isTargetMessage) {
          console.log(`TARGET: Error details:`, err);
        }
      }
    }

    console.log(`=== Resync Complete: ${updatedCount} messages updated with attachments ===`);
    return Response.json({ 
      checked: checkedCount, 
      updated: updatedCount,
      total: allMessages.length 
    });

  } catch (error) {
    console.error('Resync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});