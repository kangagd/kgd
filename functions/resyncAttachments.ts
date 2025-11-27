import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshTokenIfNeeded(user, base44) {
  const expiry = new Date(user.gmail_token_expiry);
  const now = new Date();
  
  if (expiry - now < 5 * 60 * 1000) {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    
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

    const accessToken = await refreshTokenIfNeeded(user, base44);

    // Get all email messages that don't have attachments or have empty attachments
    const allMessages = await base44.asServiceRole.entities.EmailMessage.filter({});
    
    console.log(`Found ${allMessages.length} total messages to check`);
    
    let updatedCount = 0;
    let checkedCount = 0;

    for (const emailMsg of allMessages) {
      // Skip if already has attachments with attachment_id
      if (emailMsg.attachments?.length > 0 && emailMsg.attachments[0]?.attachment_id) {
        continue;
      }

      checkedCount++;
      
      // We need to find the Gmail message ID from the message_id header
      // Search Gmail for this message
      const messageId = emailMsg.message_id;
      if (!messageId) continue;

      try {
        // Search for message by Message-ID header
        const searchQuery = encodeURIComponent(`rfc822msgid:${messageId}`);
        const searchResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!searchResponse.ok) continue;

        const searchData = await searchResponse.json();
        if (!searchData.messages?.length) continue;

        const gmailMessageId = searchData.messages[0].id;

        // Fetch full message details
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!detailResponse.ok) continue;

        const detail = await detailResponse.json();
        
        // Extract attachments
        const attachments = [];
        
        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            if (part.filename && part.filename.length > 0) {
              const attachmentId = part.body?.attachmentId;
              if (attachmentId) {
                attachments.push({
                  filename: part.filename,
                  mime_type: part.mimeType,
                  size: parseInt(part.body.size) || 0,
                  attachment_id: attachmentId,
                  gmail_message_id: gmailMessageId
                });
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

        if (attachments.length > 0) {
          console.log(`Found ${attachments.length} attachments for message: ${emailMsg.subject}`);
          await base44.asServiceRole.entities.EmailMessage.update(emailMsg.id, {
            attachments: attachments
          });
          updatedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`Error processing message ${emailMsg.id}:`, err.message);
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