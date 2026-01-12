import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfill EmailThread message direction & timestamps
 * Recalculates lastMessageDirection, lastExternalMessageAt, lastInternalMessageAt
 * from EmailMessage records for the new status chip logic
 */
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500; // Delay between batches

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processThreadBatch(base44, threads) {
  const teamDomains = ['kangaroogd.com.au'];
  let updated = 0;
  let errors = 0;
  const errorDetails = [];

  for (const thread of threads) {
    try {
      // Fetch messages for this thread
      const messages = await base44.asServiceRole.entities.EmailMessage.filter({
        thread_id: thread.id
      });

      if (messages.length === 0) {
        continue; // Skip threads with no messages
      }

      let lastExternalAt = null;
      let lastInternalAt = null;
      let lastDirection = null;

      // Sort by sent_at descending to find latest
      const sortedMessages = [...messages].sort((a, b) => {
        const dateA = new Date(a.sent_at || 0);
        const dateB = new Date(b.sent_at || 0);
        return dateB - dateA;
      });

      for (const msg of sortedMessages) {
        const fromEmail = msg.from_address?.toLowerCase() || '';
        const isInternal = teamDomains.some(domain => fromEmail.includes(domain)) || msg.is_outbound;

        if (isInternal) {
          if (!lastInternalAt) {
            lastInternalAt = msg.sent_at;
            lastDirection = 'internal';
          }
        } else {
          if (!lastExternalAt) {
            lastExternalAt = msg.sent_at;
            if (!lastDirection) {
              lastDirection = 'external';
            }
          }
        }

        // Both found, can stop early
        if (lastInternalAt && lastExternalAt) break;
      }

      // Update thread with new state
      const updateData = {
        lastMessageDirection: lastDirection,
        lastExternalMessageAt: lastExternalAt,
        lastInternalMessageAt: lastInternalAt
      };

      await base44.asServiceRole.entities.EmailThread.update(thread.id, updateData);
      updated++;

    } catch (error) {
      errors++;
      errorDetails.push({
        threadId: thread.id,
        error: error.message
      });
      console.error(`Error processing thread ${thread.id}:`, error.message);
    }
  }

  return { updated, errors, errorDetails };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Starting EmailThread state backfill (batched)...');

    // Fetch all threads
    const threads = await base44.asServiceRole.entities.EmailThread.list();
    console.log(`Found ${threads.length} email threads to process`);

    let totalUpdated = 0;
    let totalErrors = 0;
    const allErrorDetails = [];

    // Process in batches
    for (let i = 0; i < threads.length; i += BATCH_SIZE) {
      const batch = threads.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(threads.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} threads)`);

      const batchResult = await processThreadBatch(base44, batch);
      totalUpdated += batchResult.updated;
      totalErrors += batchResult.errors;
      allErrorDetails.push(...batchResult.errorDetails);

      // Delay between batches to avoid timeouts
      if (i + BATCH_SIZE < threads.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`Backfill complete: ${totalUpdated} updated, ${totalErrors} errors`);

    return Response.json({
      success: true,
      totalProcessed: threads.length,
      updated: totalUpdated,
      errors: totalErrors,
      errorDetails: totalErrors > 0 ? allErrorDetails.slice(0, 10) : []
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});