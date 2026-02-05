/**
 * gmailSyncDelta - Incremental sync triggered by Gmail push notifications
 * 
 * Fetches only changes since historyId using Gmail history API.
 * Processes new/modified messages and updates EmailThread/EmailMessage entities.
 * Much more efficient than full sync - only downloads what changed.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function gmailFetch(base44, endpoint, queryParams = null) {
  const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

  let url = `https://www.googleapis.com${endpoint}`;

  if (queryParams) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
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
    const { history_id, email_address } = JSON.parse(bodyText);

    if (!history_id) {
      return Response.json({ error: 'history_id is required' }, { status: 400 });
    }

    console.log('[gmailSyncDelta] Starting incremental sync', {
      historyId: history_id,
      emailAddress: email_address
    });

    // Fetch history records since historyId
    const historyResponse = await gmailFetch(base44, '/gmail/v1/users/me/history', {
      startHistoryId: history_id,
      historyTypes: 'messageAdded,messageDeleted'
    });

    const history = historyResponse.history || [];
    console.log(`[gmailSyncDelta] Found ${history.length} history records`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each history record
    for (const record of history) {
      try {
        // Handle added messages
        if (record.messagesAdded) {
          for (const item of record.messagesAdded) {
            try {
              // Trigger full message sync via gmailSyncThreadMessages
              await base44.asServiceRole.functions.invoke('gmailSyncThreadMessages', {
                gmail_thread_id: item.message.threadId
              });
              processedCount++;
            } catch (msgError) {
              console.error(`[gmailSyncDelta] Error processing message ${item.message.id}:`, msgError.message);
              errorCount++;
            }
          }
        }

        // Handle deleted messages (soft delete in our system)
        if (record.messagesDeleted) {
          for (const item of record.messagesDeleted) {
            try {
              const existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
                gmail_message_id: item.message.id
              });

              if (existingMessages.length > 0) {
                // Mark as deleted in our system
                await base44.asServiceRole.entities.EmailMessage.update(
                  existingMessages[0].id,
                  { is_deleted: true }
                );
                processedCount++;
              }
            } catch (delError) {
              console.error(`[gmailSyncDelta] Error deleting message ${item.message.id}:`, delError.message);
              errorCount++;
            }
          }
        }
      } catch (recordError) {
        console.error(`[gmailSyncDelta] Error processing history record:`, recordError.message);
        errorCount++;
      }
    }

    // Update stored history ID for next delta
    if (historyResponse.historyId) {
      try {
        const existing = await base44.asServiceRole.entities.AppSetting.filter({
          key: `gmail_watch_${email_address || 'default'}`
        });

        if (existing.length > 0) {
          const settings = JSON.parse(existing[0].value || '{}');
          settings.history_id = historyResponse.historyId;
          settings.last_sync_at = new Date().toISOString();

          await base44.asServiceRole.entities.AppSetting.update(existing[0].id, {
            value: JSON.stringify(settings)
          });
        }
      } catch (settingsError) {
        console.warn('[gmailSyncDelta] Failed to update history ID:', settingsError.message);
      }
    }

    console.log(`[gmailSyncDelta] Delta sync complete: ${processedCount} processed, ${errorCount} errors`);

    return Response.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      nextHistoryId: historyResponse.historyId
    });

  } catch (error) {
    console.error('[gmailSyncDelta] Fatal error:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});