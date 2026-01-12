/**
 * computeEmailThreadState - Compute inferredState for email threads
 * 
 * Uses last message direction and timestamps to determine:
 * - 'needs_reply': Last external message unanswered
 * - 'waiting_on_customer': Last internal message, not expired (< 14 days)
 * - 'none': No actionable state
 * 
 * Does NOT update threads; only returns computed state for inspection.
 * Admin-only function.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WAITING_AUTO_CLEAR_DAYS = 14;

function computeInferredState(thread) {
  const { userStatus, lastMessageDirection, lastExternalMessageAt, lastInternalMessageAt } = thread;
  
  // If manually closed, no actionable state
  if (userStatus === 'closed') {
    return 'none';
  }
  
  // needs_reply: last message was external (customer) and unanswered
  if (lastMessageDirection === 'external') {
    const lastExternalTime = lastExternalMessageAt ? new Date(lastExternalMessageAt).getTime() : 0;
    const lastInternalTime = lastInternalMessageAt ? new Date(lastInternalMessageAt).getTime() : 0;
    
    if (lastExternalTime > lastInternalTime) {
      return 'needs_reply';
    }
  }
  
  // waiting_on_customer: last message was internal, not expired
  if (lastMessageDirection === 'internal' && lastInternalMessageAt) {
    const lastInternalTime = new Date(lastInternalMessageAt).getTime();
    const lastExternalTime = lastExternalMessageAt ? new Date(lastExternalMessageAt).getTime() : 0;
    
    if (lastInternalTime > lastExternalTime) {
      const now = Date.now();
      const daysSinceInternalMessage = (now - lastInternalTime) / (1000 * 60 * 60 * 24);
      
      if (daysSinceInternalMessage <= WAITING_AUTO_CLEAR_DAYS) {
        return 'waiting_on_customer';
      }
    }
  }
  
  return 'none';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { thread_id, dry_run = true } = await req.json();

    if (!thread_id) {
      return Response.json({ error: 'thread_id is required' }, { status: 400 });
    }

    // Fetch thread
    const thread = await base44.asServiceRole.entities.EmailThread.get(thread_id);
    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const computedState = computeInferredState(thread);

    // If dry_run=false, update the thread
    if (!dry_run && thread.inferredState !== computedState) {
      await base44.asServiceRole.entities.EmailThread.update(thread_id, {
        inferredState: computedState
      });
    }

    return Response.json({
      success: true,
      thread_id,
      current_state: thread.inferredState || null,
      computed_state: computedState,
      changed: (thread.inferredState || null) !== computedState,
      dry_run,
      updated: !dry_run && (thread.inferredState || null) !== computedState
    });

  } catch (error) {
    console.error('[computeEmailThreadState] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});