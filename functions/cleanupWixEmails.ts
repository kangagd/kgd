import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Starting Wix email un-threading...');

    // Find all messages from Wix CRM
    const allMessages = await base44.asServiceRole.entities.EmailMessage.list();
    const wixMessages = allMessages.filter(msg => 
      msg.from_address && msg.from_address.includes('no-reply@crm.wix.com')
    );

    console.log(`Found ${wixMessages.length} Wix CRM messages`);

    let unthreadedCount = 0;

    // Create a separate thread for each Wix message
    for (const message of wixMessages) {
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