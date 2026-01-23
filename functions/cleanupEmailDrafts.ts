import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin-only function
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const results = {
      deletedSent: 0,
      markedAbandoned: 0,
      deletedAbandoned: 0,
    };

    // 1. Delete old sent drafts (14+ days)
    const oldSentDrafts = await base44.asServiceRole.entities.EmailDraft.filter({
      status: 'sent',
      updated_date: { $lt: fourteenDaysAgo.toISOString() },
    });
    
    for (const draft of oldSentDrafts) {
      await base44.asServiceRole.entities.EmailDraft.delete(draft.id);
      results.deletedSent++;
    }

    // 2. Mark old active drafts as abandoned (30+ days)
    const oldActiveDrafts = await base44.asServiceRole.entities.EmailDraft.filter({
      status: 'active',
      updated_date: { $lt: thirtyDaysAgo.toISOString() },
    });
    
    for (const draft of oldActiveDrafts) {
      await base44.asServiceRole.entities.EmailDraft.update(draft.id, {
        status: 'abandoned',
      });
      results.markedAbandoned++;
    }

    // 3. Delete very old abandoned drafts (90+ days)
    const veryOldAbandonedDrafts = await base44.asServiceRole.entities.EmailDraft.filter({
      status: 'abandoned',
      updated_date: { $lt: ninetyDaysAgo.toISOString() },
    });
    
    for (const draft of veryOldAbandonedDrafts) {
      await base44.asServiceRole.entities.EmailDraft.delete(draft.id);
      results.deletedAbandoned++;
    }

    return Response.json({
      success: true,
      message: `Cleaned up ${results.deletedSent + results.deletedAbandoned} drafts, marked ${results.markedAbandoned} as abandoned`,
      details: results,
    });
  } catch (error) {
    console.error('Draft cleanup error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});