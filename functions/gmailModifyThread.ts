/**
 * gmailModifyThread - Modify thread properties
 * 
 * Actions:
 *   - mark_read / mark_unread
 *   - archive / unarchive
 *   - add_label / remove_label
 * 
 * Only admin/manager can perform thread modifications.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function gmailFetch(base44, endpoint, method = 'GET', body = null, queryParams = null) {
  let retries = 0;
  const maxRetries = 3;
  const backoffMs = 1000;

  while (retries < maxRetries) {
    try {
      const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");
      
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

      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Max retries exceeded. Last status: ${response.status}`);
        }
        const waitMs = backoffMs * Math.pow(2, retries - 1);
        console.log(`[gmailFetch] Retrying in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < maxRetries - 1) {
        retries++;
        const waitMs = backoffMs * Math.pow(2, retries - 1);
        console.log(`[gmailFetch] Retry ${retries}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

Deno.serve(async (req) => {
  let stage = 'init';
  try {
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json(
        { error: 'Forbidden: Only admin/manager can modify threads' },
        { status: 403 }
      );
    }

    stage = 'parse_request';
    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};

    const { gmail_thread_id, action, label_id = null } = requestBody;

    if (!gmail_thread_id || !action) {
      return Response.json(
        { error: 'Missing gmail_thread_id or action' },
        { status: 400 }
      );
    }

    stage = 'apply_action';
    const validActions = ['mark_read', 'mark_unread', 'archive', 'unarchive', 'add_label', 'remove_label'];

    if (!validActions.includes(action)) {
      return Response.json(
        { error: `Invalid action. Valid: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let modifyPayload = {};

    switch (action) {
      case 'mark_read':
        modifyPayload = { removeLabelIds: ['UNREAD'] };
        break;
      case 'mark_unread':
        modifyPayload = { addLabelIds: ['UNREAD'] };
        break;
      case 'archive':
        modifyPayload = { removeLabelIds: ['INBOX'] };
        break;
      case 'unarchive':
        modifyPayload = { addLabelIds: ['INBOX'] };
        break;
      case 'add_label':
        if (!label_id) {
          return Response.json({ error: 'label_id required for add_label' }, { status: 400 });
        }
        modifyPayload = { addLabelIds: [label_id] };
        break;
      case 'remove_label':
        if (!label_id) {
          return Response.json({ error: 'label_id required for remove_label' }, { status: 400 });
        }
        modifyPayload = { removeLabelIds: [label_id] };
        break;
    }

    stage = 'gmail_modify';
    console.log('[gmailModifyThread] Modifying thread:', gmail_thread_id, 'action:', action);

    const result = await gmailFetch(
      base44,
      `/gmail/v1/users/me/threads/${gmail_thread_id}/modify`,
      'POST',
      modifyPayload
    );

    return Response.json({
      success: true,
      action,
      threadId: gmail_thread_id,
      result
    });
  } catch (error) {
    console.error(`[gmailModifyThread] Error at stage '${stage}':`, error);
    return Response.json(
      { error: error.message, stage },
      { status: 500 }
    );
  }
});