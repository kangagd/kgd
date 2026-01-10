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
import { gmailFetch } from './shared/gmailClientV2.js';

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