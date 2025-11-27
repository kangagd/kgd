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

    const body = await req.json();
    const { gmail_message_id, attachment_id, filename, mime_type } = body;

    if (!gmail_message_id || !attachment_id) {
      return Response.json({ error: 'Missing gmail_message_id or attachment_id' }, { status: 400 });
    }

    // First try current user, then find any user with Gmail connected (admin account)
    let user = null;
    
    // Try current user first
    const currentUsers = await base44.asServiceRole.entities.User.filter({ email: currentUser.email });
    if (currentUsers.length > 0 && currentUsers[0].gmail_access_token) {
      user = currentUsers[0];
    }
    
    // If current user doesn't have Gmail, find admin with Gmail connected
    if (!user) {
      const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const adminUser of adminUsers) {
        if (adminUser.gmail_access_token) {
          user = adminUser;
          break;
        }
      }
    }
    
    if (!user || !user.gmail_access_token) {
      return Response.json({ error: 'No Gmail account connected. Please connect Gmail in settings.' }, { status: 400 });
    }

    const accessToken = await refreshTokenIfNeeded(user, base44);

    // Fetch the attachment from Gmail
    const attResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/attachments/${attachment_id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!attResponse.ok) {
      const error = await attResponse.text();
      console.error('Failed to fetch attachment:', error);
      return Response.json({ error: 'Failed to fetch attachment from Gmail' }, { status: 500 });
    }

    const attData = await attResponse.json();
    
    if (!attData.data) {
      return Response.json({ error: 'No attachment data returned' }, { status: 500 });
    }

    // Convert base64url to regular base64 and decode to binary
    const base64Data = attData.data.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Base44 file storage
    const file = new File([bytes], filename || 'attachment', { type: mime_type || 'application/octet-stream' });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (!uploadResult?.file_url) {
      return Response.json({ error: 'Failed to upload attachment' }, { status: 500 });
    }

    return Response.json({ 
      url: uploadResult.file_url,
      filename: filename,
      mime_type: mime_type
    });

  } catch (error) {
    console.error('Get attachment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});