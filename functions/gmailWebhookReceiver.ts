/**
 * gmailWebhookReceiver - Receives Gmail push notifications and triggers incremental sync
 * 
 * Gmail notifies this endpoint when changes occur in the user's mailbox.
 * We extract the historyId and trigger gmailSyncDelta to fetch only new/changed messages.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Gmail sends POST requests with the notification payload
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);

    const bodyText = await req.text();
    const notification = JSON.parse(bodyText);

    console.log('[gmailWebhookReceiver] Received notification:', {
      emailAddress: notification.emailAddress,
      historyId: notification.historyId,
      expiration: notification.expiration
    });

    // Extract the email address from the notification
    const emailAddress = notification.emailAddress;
    if (!emailAddress) {
      console.log('[gmailWebhookReceiver] No emailAddress in notification, ignoring');
      return Response.json({ success: true });
    }

    // Optional: Validate the notification came from Google
    // In production, you'd verify the signature using the X-Goog-Gmail-Authentication-Token-Contents header
    // For now, we'll trust it came through our webhook endpoint

    // Trigger incremental sync for this user
    // In a real implementation, you'd look up the user by emailAddress and call gmailSyncDelta
    // For now, we'll invoke the sync function with the historyId
    try {
      const syncResponse = await base44.asServiceRole.functions.invoke('gmailSyncDelta', {
        email_address: emailAddress,
        history_id: notification.historyId,
        // Optional expiration hint from Gmail (in seconds from epoch)
        expiration: notification.expiration
      });

      console.log('[gmailWebhookReceiver] Sync triggered successfully', syncResponse);
    } catch (syncError) {
      console.error('[gmailWebhookReceiver] Error triggering sync:', syncError.message);
      // Still return 200 to acknowledge the notification
      // Gmail will retry if we return an error
    }

    // Always return 200 OK to acknowledge the notification
    return Response.json({ success: true });
  } catch (error) {
    console.error('[gmailWebhookReceiver] Fatal error:', error.message);
    // Return 200 anyway to prevent Gmail from retrying
    return Response.json({ success: false, error: error.message });
  }
});