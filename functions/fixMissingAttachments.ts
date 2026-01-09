import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Find any user with Gmail connected
    const users = await base44.asServiceRole.entities.User.list();
    const gmailUser = users.find(u => u.gmail_access_token);

    if (!gmailUser) {
      return Response.json({ error: 'No Gmail account connected' }, { status: 400 });
    }

    console.log(`Using Gmail account: ${gmailUser.email}`);
    const accessToken = await refreshTokenIfNeeded(gmailUser, base44);

    // Find messages with inline images but no attachments
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({
      body_html: { $exists: true, $ne: null }
    });
    const messagesToFix = messages.filter(msg => 
      msg.body_html && 
      msg.body_html.includes('cid:') && 
      (!msg.attachments || msg.attachments.length === 0) &&
      msg.gmail_message_id
    ).slice(0, 50); // Limit to 50 to avoid timeout

    console.log(`Found ${messagesToFix.length} messages with missing attachments`);

    let fixed = 0;
    const errors = [];

    for (const message of messagesToFix) {
      try {
        // Fetch message details from Gmail
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.gmail_message_id}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!detailResponse.ok) {
          console.error(`Failed to fetch message ${message.gmail_message_id}`);
          continue;
        }

        const detail = await detailResponse.json();
        const attachments = [];

        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            try {
              if (part.filename && part.filename.length > 0) {
                const attachmentId = part.body?.attachmentId;
                if (attachmentId) {
                  const contentIdHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
                  const contentDisposition = part.headers?.find(h => h.name.toLowerCase() === 'content-disposition');
                  const contentId = contentIdHeader?.value?.replace(/[<>]/g, '');
                  const isInline = contentDisposition?.value?.toLowerCase().includes('inline') || !!contentId;
                  
                  attachments.push({
                    filename: part.filename,
                    mime_type: part.mimeType,
                    size: parseInt(part.body.size) || 0,
                    attachment_id: attachmentId,
                    gmail_message_id: message.gmail_message_id,
                    content_id: contentId || null,
                    is_inline: isInline
                  });
                }
              }
              
              if (part.parts) {
                processParts(part.parts);
              }
            } catch (err) {
              console.error('Error processing part:', err);
            }
          }
        };

        if (detail.payload.parts) {
          processParts(detail.payload.parts);
        }

        if (attachments.length > 0) {
          await base44.asServiceRole.entities.EmailMessage.update(message.id, {
            attachments: attachments
          });
          fixed++;
          console.log(`Fixed message ${message.id} - added ${attachments.length} attachments`);
        }

      } catch (msgError) {
        console.error(`Error fixing message ${message.id}:`, msgError.message);
        errors.push({ message_id: message.id, error: msgError.message });
      }
    }

    return Response.json({
      success: true,
      fixed,
      total_checked: messagesToFix.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Fix missing attachments error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});