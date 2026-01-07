import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Starting Wix email un-threading...');

    // Process in batches to avoid timeout (502 errors)
    const BATCH_SIZE = 50;
    
    // Filter Wix messages directly from database
    const wixMessages = await base44.asServiceRole.entities.EmailMessage.filter({
      from_address: 'no-reply@crm.wix.com'
    });

    // Check which messages already have unique threads
    const threads = await base44.asServiceRole.entities.EmailThread.list();
    const processedIds = new Set(
      threads
        .filter(t => t.gmail_thread_id?.startsWith('wix-'))
        .map(t => t.gmail_thread_id?.replace('wix-', ''))
        .filter(Boolean)
    );

    const toProcess = wixMessages
      .filter(msg => !processedIds.has(msg.id))
      .slice(0, BATCH_SIZE);

    console.log(`Found ${toProcess.length} unprocessed Wix messages (${wixMessages.length - toProcess.length} already processed)`);

    if (toProcess.length === 0) {
      return Response.json({
        success: true,
        unthreadedCount: 0,
        hasMore: false,
        message: 'All Wix messages already un-threaded'
      });
    }

    let unthreadedCount = 0;

    // Create a separate thread for each Wix message
    for (const message of toProcess) {
      try {
        // Create a new thread for this message
        const newThread = await base44.asServiceRole.entities.EmailThread.create({
          subject: message.subject || '(No Subject)',
          gmail_thread_id: `wix-${message.id}`, // Unique thread ID
          from_address: message.from_address,
          to_addresses: message.to_addresses || [],
          last_message_date: message.sent_at,
          last_message_snippet: message.body_text?.substring(0, 200) || '',
          status: 'Open',
          priority: 'Normal',
          message_count: 1
        });

        // Update message to point to the new thread
        await base44.asServiceRole.entities.EmailMessage.update(message.id, {
          thread_id: newThread.id
        });

        unthreadedCount++;
        console.log(`Un-threaded Wix message ${message.id} to new thread ${newThread.id}`);
      } catch (err) {
        console.error(`Failed to un-thread message ${message.id}:`, err.message);
      }
    }

    console.log('Un-threading complete');
    return Response.json({
      success: true,
      unthreadedCount,
      message: `Un-threaded ${unthreadedCount} Wix messages into separate threads`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});