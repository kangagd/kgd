import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Separate Wix CRM threads that were incorrectly grouped together.
 * Each Wix form submission should be a separate thread, not grouped by Gmail.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    // Find all threads from Wix CRM
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const wixThreads = allThreads.filter(t => 
      t.from_address && t.from_address.toLowerCase().includes('no-reply@crm.wix.com')
    );

    console.log(`[separateWixThreads] Found ${wixThreads.length} Wix threads`);

    let separated = 0;
    let skipped = 0;

    for (const thread of wixThreads) {
      try {
        // Get all messages in this thread
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({
          thread_id: thread.id
        }, 'sent_at');

        if (messages.length <= 1) {
          skipped++;
          continue; // Already separated or single message
        }

        console.log(`[separateWixThreads] Thread ${thread.id} has ${messages.length} messages - separating...`);

        // Keep first message in original thread, move others to new threads
        for (let i = 1; i < messages.length; i++) {
          const msg = messages[i];
          
          try {
            // Create new thread for this message
            const newThread = await base44.asServiceRole.entities.EmailThread.create({
              subject: thread.subject,
              gmail_thread_id: thread.gmail_thread_id ? `${thread.gmail_thread_id}-separated-${i}` : null,
              from_address: thread.from_address,
              to_addresses: thread.to_addresses,
              last_message_date: msg.sent_at,
              last_message_snippet: msg.body_text?.substring(0, 200) || msg.body_html?.substring(0, 200) || 'Wix form submission',
              message_count: 1,
              status: thread.status || 'Open',
              priority: thread.priority || 'Normal',
              isUnread: thread.isUnread,
              last_activity_at: msg.sent_at
            });

            // Move message to new thread
            await base44.asServiceRole.entities.EmailMessage.update(msg.id, {
              thread_id: newThread.id
            });

            separated++;
            console.log(`[separateWixThreads] Moved message ${msg.id} to new thread ${newThread.id}`);
          } catch (err) {
            console.error(`[separateWixThreads] Error moving message ${msg.id}:`, err.message);
          }
        }

        // Update original thread message count
        await base44.asServiceRole.entities.EmailThread.update(thread.id, {
          message_count: 1
        });

      } catch (err) {
        console.error(`[separateWixThreads] Error processing thread ${thread.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      wixThreadsFound: wixThreads.length,
      separated,
      skipped,
      message: `Separated ${separated} Wix messages into individual threads`
    });
  } catch (error) {
    console.error('[separateWixThreads] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});