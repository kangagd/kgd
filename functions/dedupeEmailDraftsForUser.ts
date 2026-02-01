import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only check
    if (user?.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all active drafts for the user
    const activeDrafts = await base44.entities.EmailDraft.filter(
      {
        created_by: user.email,
        status: 'active'
      },
      '-updated_date',
      1000
    );

    // Group drafts by draft_key
    const draftsByKey = {};
    activeDrafts.forEach(draft => {
      const key = draft.draft_key;
      if (!draftsByKey[key]) {
        draftsByKey[key] = [];
      }
      draftsByKey[key].push(draft);
    });

    // For each group, mark duplicates as "discarded"
    let deduped = 0;
    const updates = [];

    for (const key in draftsByKey) {
      const group = draftsByKey[key];
      if (group.length > 1) {
        // Keep the first (most recent), mark rest as discarded
        for (let i = 1; i < group.length; i++) {
          updates.push({
            id: group[i].id,
            data: { status: 'discarded' }
          });
          deduped++;
        }
      }
    }

    // Batch update discarded drafts
    for (const update of updates) {
      await base44.entities.EmailDraft.update(update.id, update.data);
    }

    return Response.json({
      success: true,
      message: `Deduped ${deduped} draft(s)`,
      deduped_count: deduped,
      by_user: user.email
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});