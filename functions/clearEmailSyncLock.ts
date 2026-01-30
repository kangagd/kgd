/**
 * clearEmailSyncLock - Admin-only force unlock for email sync
 * 
 * Allows admin@kangaroogd.com.au to clear stuck sync locks
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only access
    if (user.email !== 'admin@kangaroogd.com.au') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const bodyText = await req.text();
    const { scope_key } = bodyText ? JSON.parse(bodyText) : {};

    const scopeKey = scope_key || 'gmail';

    // Find sync state
    const states = await base44.asServiceRole.entities.EmailSyncState.filter({ scope_key: scopeKey });
    
    if (!states || states.length === 0) {
      return Response.json({
        success: true,
        cleared: false,
        reason: 'no_state'
      });
    }

    const syncState = states[0];

    // Clear lock fields
    await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
      lock_until: null,
      lock_owner: null
    });

    console.log(`[clearEmailSyncLock] Lock cleared for scope: ${scopeKey} by ${user.email}`);

    return Response.json({
      success: true,
      cleared: true,
      scope_key: scopeKey
    });
  } catch (error) {
    console.error('[clearEmailSyncLock] Error:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});