import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find threads with Feb 2, 2026 dates (sync artifact)
    const feb2Start = new Date('2026-02-02T00:00:00Z').toISOString();
    const feb2End = new Date('2026-02-02T23:59:59Z').toISOString();

    const threads = await base44.asServiceRole.entities.EmailThread.filter({
      last_message_date: { $gte: feb2Start, $lte: feb2End }
    });

    console.log(`Found ${threads.length} threads with Feb 2 dates`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const thread of threads) {
      try {
        // Get messages for this thread
        const messages = await base44.asServiceRole.entities.EmailMessage.filter(
          { thread_id: thread.id },
          '-sent_at',
          1
        );

        if (messages.length === 0) {
          skipped++;
          continue;
        }

        const latestMessage = messages[0];
        const correctDate = latestMessage.sent_at;

        // Only update if date is different
        if (correctDate && correctDate !== thread.last_message_date) {
          await base44.asServiceRole.entities.EmailThread.update(thread.id, {
            last_message_date: correctDate
          });
          fixed++;
          console.log(`Fixed thread ${thread.id}: ${thread.last_message_date} -> ${correctDate}`);
        } else {
          skipped++;
        }

        // Small delay to avoid rate limits
        if (fixed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Error fixing thread ${thread.id}:`, err.message);
        errors++;
      }
    }

    return Response.json({
      success: true,
      total: threads.length,
      fixed,
      skipped,
      errors
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});