import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Starting thread project link backfill...');

    // Get all threads that have project or job links
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const linkedThreads = allThreads.filter(t => 
      (t.linked_project_id || t.project_id || t.linked_job_id) && !t.is_deleted
    );

    console.log(`Found ${linkedThreads.length} linked threads to process`);

    let threadsProcessed = 0;
    let messagesUpdated = 0;
    let threadsConsolidated = 0;

    for (const thread of linkedThreads) {
      try {
        // Find all messages that belong to this Gmail thread
        const messagesInThread = await base44.asServiceRole.entities.EmailMessage.filter({
          thread_id: thread.gmail_thread_id
        });

        // Also find messages linked to this Base44 thread ID
        const messagesInBase44Thread = await base44.asServiceRole.entities.EmailMessage.filter({
          thread_id: thread.id
        });

        // Combine and dedupe
        const allMessages = [...messagesInThread, ...messagesInBase44Thread];
        const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.id, m])).values());

        console.log(`Thread ${thread.id} (${thread.subject}): ${uniqueMessages.length} messages`);

        // Update all messages to point to the correct Base44 thread
        for (const msg of uniqueMessages) {
          if (msg.thread_id !== thread.id) {
            await base44.asServiceRole.entities.EmailMessage.update(msg.id, {
              thread_id: thread.id
            });
            messagesUpdated++;
          }
        }

        // Check for duplicate threads with same gmail_thread_id
        const duplicateThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: thread.gmail_thread_id
        });

        if (duplicateThreads.length > 1) {
          // Keep the one with project/job link, soft-delete others
          const threadsToDelete = duplicateThreads.filter(t => t.id !== thread.id);
          for (const dupThread of threadsToDelete) {
            await base44.asServiceRole.entities.EmailThread.update(dupThread.id, {
              is_deleted: true
            });
          }
          threadsConsolidated += threadsToDelete.length;
        }

        threadsProcessed++;
      } catch (error) {
        console.error(`Error processing thread ${thread.id}:`, error);
      }
    }

    console.log('Backfill complete');
    return Response.json({
      success: true,
      threadsProcessed,
      messagesUpdated,
      threadsConsolidated
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});