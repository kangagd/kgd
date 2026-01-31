import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * One-time backfill: Fix thread last_message_date to match newest message sent_at
 * Admin-only function
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batch_size = 50, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[backfillThreadLastMessageDates] Starting (dry_run=${dry_run})`);

    // Fetch all threads
    const allThreads = await base44.asServiceRole.entities.EmailThread.filter({});
    console.log(`[backfillThreadLastMessageDates] Found ${allThreads.length} threads`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < allThreads.length; i += batch_size) {
      const batch = allThreads.slice(i, i + batch_size);

      for (const thread of batch) {
        try {
          // Fetch all messages for this thread
          const messages = await base44.asServiceRole.entities.EmailMessage.filter(
            { thread_id: thread.id },
            '-sent_at',
            1 // Only need the newest
          );

          if (messages.length === 0) {
            unchanged++;
            continue;
          }

          const newestMessage = messages[0];
          const correctDate = newestMessage.sent_at;

          // Check if update needed
          if (thread.last_message_date === correctDate) {
            unchanged++;
            continue;
          }

          // Update thread
          if (!dry_run) {
            await base44.asServiceRole.entities.EmailThread.update(thread.id, {
              last_message_date: correctDate,
            });
          }

          updated++;

          if (updated % 10 === 0) {
            console.log(`[backfillThreadLastMessageDates] Progress: ${updated} updated, ${unchanged} unchanged`);
          }
        } catch (err) {
          console.error(`[backfillThreadLastMessageDates] Error on thread ${thread.id}:`, err.message);
          errors++;
        }
      }

      // Rate limiting between batches
      if (i + batch_size < allThreads.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const summary = {
      success: true,
      total_threads: allThreads.length,
      updated,
      unchanged,
      errors,
      dry_run,
    };

    console.log(`[backfillThreadLastMessageDates] Complete:`, summary);

    return Response.json(summary);
  } catch (error) {
    console.error('[backfillThreadLastMessageDates] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});