import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfill EmailThread message direction & timestamps
 * Recalculates lastMessageDirection, lastExternalMessageAt, lastInternalMessageAt
 * from EmailMessage records for the new status chip logic
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Starting EmailThread state backfill...');

    // Fetch all threads
    const threads = await base44.asServiceRole.entities.EmailThread.list();
    console.log(`Found ${threads.length} email threads to process`);

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

        // Determine if messages are internal (from team) or external
        // Team email addresses (can be expanded as needed)
        const teamDomains = ['kangaroogd.com.au'];
        
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
          
          const sentDate = new Date(msg.sent_at);

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

    console.log(`Backfill complete: ${updated} updated, ${errors} errors`);

    return Response.json({
      success: true,
      totalProcessed: threads.length,
      updated,
      errors,
      errorDetails: errors > 0 ? errorDetails.slice(0, 10) : []
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});