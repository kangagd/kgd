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

    const { batch_size = 10, dry_run = false, max_threads = 100 } = await req.json().catch(() => ({}));

    console.log(`[backfillThreadLastMessageDates] Starting (dry_run=${dry_run}, batch_size=${batch_size}, max_threads=${max_threads})`);

    // Fetch threads in limited batches
    const allThreads = await base44.asServiceRole.entities.EmailThread.filter({}, '-last_message_date', max_threads);
    console.log(`[backfillThreadLastMessageDates] Found ${allThreads.length} threads to process`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    // Process in small batches with delays
    for (let i = 0; i < allThreads.length; i += batch_size) {
      const batch = allThreads.slice(i, i + batch_size);
      console.log(`[backfillThreadLastMessageDates] Processing batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(allThreads.length / batch_size)}`);

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

          // Delay between updates to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`[backfillThreadLastMessageDates] Error on thread ${thread.id}:`, err.message);
          console.error('Error data:', err.data || err);
          errors++;
        }
      }

      // Rate limiting between batches
      if (i + batch_size < allThreads.length) {
        console.log(`[backfillThreadLastMessageDates] Progress: ${updated} updated, ${unchanged} unchanged, ${errors} errors`);
        await new Promise(resolve => setTimeout(resolve, 2000));
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