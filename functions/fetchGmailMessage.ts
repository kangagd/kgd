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
    const { gmail_message_id } = await req.json();

    if (!gmail_message_id) {
       return Response.json({ error: 'gmail_message_id required' }, { status: 400 });
    }

    const currentUser = await base44.auth.me();
    if (!currentUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (users.length === 0) return Response.json({ error: 'User not found' }, { status: 404 });
    const user = users[0];

    if (!user.gmail_access_token) return Response.json({ error: 'Gmail not connected' }, { status: 400 });

    const accessToken = await refreshTokenIfNeeded(user, base44);

    const detailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!detailResponse.ok) {
        const err = await detailResponse.text();
        throw new Error(`Gmail fetch failed: ${err}`);
    }

    const detail = await detailResponse.json();
    
    // Process body and attachments (simplified logic from gmailSync)
    let bodyHtml = '';
    let bodyText = detail.snippet || '';
    const attachments = [];

    const processParts = (parts) => {
      if (!parts || !Array.isArray(parts)) return;
      for (const part of parts) {
        try {
          if (part.mimeType === 'text/html' && part.body?.data) {
            const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            if (decoded) bodyHtml = decoded;
          } else if (part.mimeType === 'text/plain' && part.body?.data) {
            const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            if (decoded) bodyText = decoded;
          }
          
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
                gmail_message_id: gmail_message_id,
                content_id: contentId || null,
                is_inline: isInline
              });
            }
          }
          
          if (part.parts) processParts(part.parts);
        } catch (err) {
          console.error('Error processing part:', err);
        }
      }
    };

    try {
      if (detail.payload.body?.data) {
        const decoded = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        if (decoded) bodyText = decoded;
      }
    } catch (err) {}
    
    if (detail.payload.parts) {
      processParts(detail.payload.parts);
    }

    return Response.json({
        body_html: bodyHtml,
        body_text: bodyText,
        attachments
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});