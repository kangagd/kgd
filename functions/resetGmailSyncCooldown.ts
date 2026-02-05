import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find and reset the sync state
    const scopeKey = `user:${user.id}`;
    const existing = await base44.asServiceRole.entities.EmailSyncState.filter({
      scope_key: scopeKey
    });

    if (existing.length === 0) {
      return Response.json({ success: true, message: 'No sync state to reset' });
    }

    // Reset cooldown
    await base44.asServiceRole.entities.EmailSyncState.update(existing[0].id, {
      consecutive_failures: 0,
      last_failure_at: null,
      cooldown_until: null,
      last_success_at: new Date().toISOString()
    });

    console.log('[resetGmailSyncCooldown] Cooldown cleared for', scopeKey);

    return Response.json({ success: true, message: 'Cooldown reset' });
  } catch (error) {
    console.error('[resetGmailSyncCooldown] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});