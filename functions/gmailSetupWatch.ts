/**
 * gmailSetupWatch - Registers a webhook with Gmail to receive push notifications
 * 
 * Creates a watch on the user's mailbox. Gmail will POST to gmailWebhookReceiver
 * whenever changes occur. Watches expire after ~7 days and need to be renewed.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function gmailFetch(base44, endpoint, method = 'POST', body = null) {
  const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://www.googleapis.com${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[gmailSetupWatch] Setting up watch for user:', user.email);

    // Get the webhook URL from environment or construct it
    const webhookUrl = Deno.env.get('GMAIL_WEBHOOK_URL') || 
      `https://api.base44.app/webhooks/gmail/${user.email}`;

    // Call Gmail watch API
    const watchResponse = await gmailFetch(
      base44,
      '/gmail/v1/users/me/watch',
      'POST',
      {
        topicName: 'projects/kangaroogd-crm/topics/gmail-notifications',
        labelIds: ['INBOX'] // Watch only inbox changes
      }
    );

    console.log('[gmailSetupWatch] Watch response:', {
      historyId: watchResponse.historyId,
      expiration: new Date(parseInt(watchResponse.expiration)).toISOString()
    });

    // Store watch metadata for future renewal
    try {
      const watchSettings = {
        history_id: watchResponse.historyId,
        expiration: watchResponse.expiration, // Unix timestamp in millis
        expires_at: new Date(parseInt(watchResponse.expiration)).toISOString(),
        setup_at: new Date().toISOString(),
        user_email: user.email
      };

      // Save to AppSetting entity for tracking/renewal
      await base44.asServiceRole.entities.AppSetting.create({
        key: `gmail_watch_${user.email}`,
        value: JSON.stringify(watchSettings),
        description: 'Gmail push notification watch metadata'
      });

      console.log('[gmailSetupWatch] Watch metadata saved');
    } catch (settingsError) {
      console.warn('[gmailSetupWatch] Failed to save watch metadata:', settingsError.message);
      // Continue anyway - watch is still active
    }

    return Response.json({
      success: true,
      historyId: watchResponse.historyId,
      expiresAt: new Date(parseInt(watchResponse.expiration)).toISOString(),
      message: 'Gmail watch setup complete. Notifications will be sent to webhook.'
    });

  } catch (error) {
    console.error('[gmailSetupWatch] Error:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});