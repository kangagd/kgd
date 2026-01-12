/**
 * gmailSyncOrchestrated - Master sync that coordinates thread + message sync
 * 
 * Strategy:
 * 1. Sync thread metadata (gmailSyncInbox) - creates thread records, deduplicates by gmail_thread_id
 * 2. Sync full messages (gmailSync) - fetches bodies, links to threads, creates EmailMessage records
 * 3. Rate limit between phases to avoid quota thrashing
 * 4. Isolate errors so one phase failure doesn't block the other
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and manager can trigger sync
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = {
      phases: [],
      errors: [],
      summary: {}
    };

    try {
      console.log('[gmailSyncOrchestrated] Phase 1: Sync thread metadata');
      const threadSyncStart = Date.now();
      
      const threadResponse = await base44.functions.invoke('gmailSyncInbox', {
        maxResults: 50
      });
      
      const threadResult = threadResponse.data || threadResponse;
      console.log('[gmailSyncOrchestrated] Phase 1 raw result:', threadResult);
      
      results.phases.push({
        name: 'gmailSyncInbox',
        synced: threadResult.synced || 0,
        duration: Date.now() - threadSyncStart,
        status: 'success'
      });
      
      console.log(`[gmailSyncOrchestrated] Phase 1 complete: ${threadResult.synced || 0} threads synced in ${Date.now() - threadSyncStart}ms`);
    } catch (error) {
      console.error('[gmailSyncOrchestrated] Phase 1 (thread sync) failed:', error.message);
      results.phases.push({
        name: 'gmailSyncInbox',
        status: 'error',
        error: error.message
      });
      results.errors.push(`Thread sync failed: ${error.message}`);
      // Don't block message sync if thread sync fails
    }

    // Rate limit between phases (500ms to avoid quota thrashing)
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      console.log('[gmailSyncOrchestrated] Phase 2: Sync full messages');
      const msgSyncStart = Date.now();
      
      const msgResponse = await base44.functions.invoke('gmailSync', {});
      
      const msgResult = msgResponse.data || msgResponse;
      console.log('[gmailSyncOrchestrated] Phase 2 raw result:', msgResult);
      
      results.phases.push({
        name: 'gmailSync',
        synced: msgResult.synced || 0,
        total: msgResult.total || 0,
        duration: Date.now() - msgSyncStart,
        status: 'success'
      });
      
      console.log(`[gmailSyncOrchestrated] Phase 2 complete: ${msgResult.synced || 0} messages synced in ${Date.now() - msgSyncStart}ms`);
    } catch (error) {
      console.error('[gmailSyncOrchestrated] Phase 2 (message sync) failed:', error.message);
      results.phases.push({
        name: 'gmailSync',
        status: 'error',
        error: error.message
      });
      results.errors.push(`Message sync failed: ${error.message}`);
      // Don't block—message sync can retry independently
    }

    // Build summary
    const threadPhase = results.phases.find(p => p.name === 'gmailSyncInbox');
    const msgPhase = results.phases.find(p => p.name === 'gmailSync');
    
    results.summary = {
      threads_synced: threadPhase?.synced || 0,
      messages_synced: msgPhase?.synced || 0,
      total_time_ms: results.phases.reduce((sum, p) => sum + (p.duration || 0), 0),
      phases_succeeded: results.phases.filter(p => p.status === 'success').length,
      phases_failed: results.phases.filter(p => p.status === 'error').length,
      has_errors: results.errors.length > 0
    };

    console.log('[gmailSyncOrchestrated] Complete:', results.summary);

    return Response.json({
      success: results.errors.length === 0,
      ...results
    });
  } catch (error) {
    console.error('[gmailSyncOrchestrated] Fatal error:', error);
    return Response.json(
      { 
        error: error.message,
        success: false
      },
      { status: 500 }
    );
  }
});