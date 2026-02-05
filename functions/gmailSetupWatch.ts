/**
 * gmailSetupWatch - Register webhook with Gmail API to receive push notifications
 * 
 * Sets up a watch on the user's mailbox that will send push notifications
 * to the configured webhook URL when changes occur.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function gmailFetch(base44, endpoint, method = 'GET', body = null) {
  const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

  const url = `https://www.googleapis.com${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const bodyText = await req.text();
    const { webhook_url } = bodyText ? JSON.parse(bodyText) : {};

    // Use webhook URL from request or construct from environment
    const finalWebhookUrl = webhook_url || Deno.env.get('GMAIL_WEBHOOK_URL');

    if (!finalWebhookUrl) {
      return Response.json(
        { error: 'webhook_url is required or GMAIL_WEBHOOK_URL env var must be set' },
        { status: 400 }
      );
    }

    console.log('[gmailSetupWatch] Setting up Gmail watch', { webhook_url: finalWebhookUrl });

    // Register watch with Gmail
    const watchResponse = await gmailFetch(
      base44,
      '/gmail/v1/users/me/watch',
      'POST',
      {
        topicName: 'projects/base44-app/topics/gmail-notifications',
        labelIds: ['INBOX']
      }
    );

    // Store watch metadata for future reference
    const historyId = watchResponse.historyId;
    const expiration = watchResponse.expiration;

    const watchMetadata = {
      webhook_url: finalWebhookUrl,
      history_id: historyId,
      expiration: expiration,
      setup_at: new Date().toISOString(),
      last_notification_at: null
    };

    // Save to AppSetting for persistence
    const existing = await base44.asServiceRole.entities.AppSetting.filter({
      key: 'gmail_watch_config'
    });

    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSetting.update(existing[0].id, {
        value: JSON.stringify(watchMetadata)
      });
    } else {
      await base44.asServiceRole.entities.AppSetting.create({
        key: 'gmail_watch_config',
        value: JSON.stringify(watchMetadata)
      });
    }

    console.log('[gmailSetupWatch] Watch registered successfully', {
      historyId: historyId,
      expiration: new Date(parseInt(expiration)).toISOString()
    });

    return Response.json({
      success: true,
      historyId: historyId,
      expiration: expiration,
      webhookUrl: finalWebhookUrl
    });

  } catch (error) {
    console.error('[gmailSetupWatch] Error setting up watch:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});