/**
 * gmailSyncOrchestrated - Reliable orchestrator with locking, delta/backfill, and CID resolution
 * 
 * Guarantees:
 * - Only one orchestrated sync runs at a time (via soft lock)
 * - Delta-based incremental sync when possible
 * - Controlled backfill when history is stale
 * - Throttled CID resolution (non-blocking)
 * - Structured summary for observability
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_FAILURES = 3;

// ============================================================================
// Lock Management
// ============================================================================

async function acquireLock(base44, scopeKey, runId) {
  const states = await base44.asServiceRole.entities.EmailSyncState.filter({ scope_key: scopeKey });
  let syncState = states[0];

  if (!syncState) {
    // Create new state with lock
    syncState = await base44.asServiceRole.entities.EmailSyncState.create({
      scope_key: scopeKey,
      lock_until: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
      lock_owner: runId,
      locked_at: new Date().toISOString(),
      consecutive_failures: 0,
      backfill_mode: 'off'
    });
    return { acquired: true, syncState };
  }

  const now = Date.now();
  const lockUntilMs = syncState.lock_until ? new Date(syncState.lock_until).getTime() : 0;

  // LOCK SELF-HEAL: If lock_until is missing, invalid, or in past, clear lock fields
  if (!syncState.lock_until || isNaN(lockUntilMs) || lockUntilMs <= now) {
    // Auto-heal stale lock
    syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
      lock_until: null,
      lock_owner: null,
      locked_at: null
    });
  } else {
    // Active lock held by another process
    return { acquired: false, reason: 'locked', locked_until: syncState.lock_until, syncState };
  }

  // Acquire lock
  syncState = await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
    lock_until: new Date(now + LOCK_TTL_MS).toISOString(),
    lock_owner: runId,
    locked_at: new Date().toISOString()
  });

  return { acquired: true, syncState };
}

async function releaseLock(base44, syncStateId, runId) {
  try {
    const currentState = await base44.asServiceRole.entities.EmailSyncState.get(syncStateId);
    if (currentState.lock_owner === runId) {
      await base44.asServiceRole.entities.EmailSyncState.update(syncStateId, {
        lock_until: null,
        lock_owner: null,
        locked_at: null
      });
    }
  } catch (err) {
    console.warn(`[releaseLock] Warning:`, err.message);
  }
}

// ============================================================================
// CID Resolution (opportunistic)
// ============================================================================

async function attemptCidResolutionBatch(base44, maxBatch = 25) {
  try {
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({
      cid_state: 'unresolved'
    }, '-cid_last_attempt_at', maxBatch);

    let resolved = 0;
    for (const message of messages) {
      // Check if enough time has passed (10 minute backoff)
      const lastAttempt = message.cid_last_attempt_at ? new Date(message.cid_last_attempt_at).getTime() : 0;
      const now = Date.now();
      if (lastAttempt && now - lastAttempt < 10 * 60 * 1000) continue;

      // Attempt resolution (non-blocking)
      try {
        const result = await base44.functions.invoke('attemptResolveInlineCids', {
          message_id: message.id
        });
        if (result.data?.resolved) {
          resolved++;
        }
      } catch (err) {
        // Silently continue; CID resolution failures don't block the sync
      }
    }

    return { attempted: messages.length, resolved };
  } catch (err) {
    console.warn('[gmailSyncOrchestrated] CID batch warning:', err.message);
    return { attempted: 0, resolved: 0 };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  const runId = crypto.randomUUID();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const { scope_key } = bodyText ? JSON.parse(bodyText) : {};

    const scopeKey = scope_key || `user:${user.id}`;

    console.log(`[gmailSyncOrchestrated] Starting run ${runId} for scope ${scopeKey}`);

    // Phase 1: Acquire lock
    const lockResult = await acquireLock(base44, scopeKey, runId);

    if (!lockResult.acquired) {
      return Response.json({
        success: false,
        run_id: runId,
        reason: 'locked',
        locked_until: lockResult.locked_until,
        skipped: true
      });
    }

    const syncState = lockResult.syncState;

    try {
      // Check for cooldown after too many failures
      if (syncState.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
        const lastErrorTime = syncState.last_error_at ? new Date(syncState.last_error_at).getTime() : 0;
        const now = Date.now();
        if (now - lastErrorTime < COOLDOWN_MS) {
          return Response.json({
            success: false,
            run_id: runId,
            reason: 'in_cooldown',
            consecutive_failures: syncState.consecutive_failures,
            retry_after_ms: COOLDOWN_MS - (now - lastErrorTime)
          });
        }
      }

      // Phase 2: Run delta or backfill
      const deltaResponse = await base44.functions.invoke('gmailSyncDelta', {
        scope_key: scopeKey,
        max_history_pages: 10,
        max_messages_fetched: 10
      });

      const deltaResult = deltaResponse.data;

      if (!deltaResult.success) {
        throw new Error(deltaResult.error || 'Delta returned failure');
      }

      // Phase 3: Opportunistic CID resolution
      const cidResult = await attemptCidResolutionBatch(base44, 25);

      // Phase 4: Update state on success
      await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0,
        last_error_at: null,
        last_error_message: null
      });

      const summary = {
        success: true,
        run_id: runId,
        mode: deltaResult.mode,
        state: {
          last_history_id: deltaResult.new_last_history_id || syncState.last_history_id,
          backfill_mode: syncState.backfill_mode,
          backfill_cursor: syncState.backfill_cursor
        },
        counts: {
          ...deltaResult.counts,
          cid_resolution_attempted: cidResult.attempted,
          cid_resolution_resolved: cidResult.resolved
        }
      };

      console.log(`[gmailSyncOrchestrated] Success: ${JSON.stringify(summary)}`);

      return Response.json(summary);
    } catch (err) {
      // Phase 4b: Handle error
      const updatedFailures = (syncState.consecutive_failures || 0) + 1;

      await base44.asServiceRole.entities.EmailSyncState.update(syncState.id, {
        last_error_at: new Date().toISOString(),
        last_error_message: err.message,
        consecutive_failures: updatedFailures
      });

      console.error(`[gmailSyncOrchestrated] Error (${updatedFailures} consecutive):`, err.message);

      return Response.json({
        success: false,
        run_id: runId,
        error: err.message,
        consecutive_failures: updatedFailures
      }, { status: 500 });
    } finally {
      // Always release lock (only if we own it)
      await releaseLock(base44, syncState.id, runId);
    }
  } catch (error) {
    console.error(`[gmailSyncOrchestrated] Fatal error:`, error.message);
    return Response.json(
      { error: error.message, run_id: runId },
      { status: 500 }
    );
  }
});