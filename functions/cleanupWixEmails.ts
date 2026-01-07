import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Starting Wix email cleanup...');

    // Find all messages from Wix CRM
    const allMessages = await base44.asServiceRole.entities.EmailMessage.list();
    const wixMessages = allMessages.filter(msg => 
      msg.from_address && msg.from_address.includes('no-reply@crm.wix.com')
    );

    console.log(`Found ${wixMessages.length} Wix CRM messages`);

    // Get unique thread IDs from these messages
    const wixThreadIds = [...new Set(wixMessages.map(msg => msg.thread_id).filter(Boolean))];
    console.log(`Found ${wixThreadIds.length} threads containing Wix messages`);

    let deletedMessages = 0;
    let deletedThreads = 0;

    // Delete all Wix messages
    for (const message of wixMessages) {
      try {
        await base44.asServiceRole.entities.EmailMessage.delete(message.id);
        deletedMessages++;
      } catch (err) {
        console.error(`Failed to delete message ${message.id}:`, err.message);
      }
    }

    // Check each thread - if it has no remaining messages, delete it
    for (const threadId of wixThreadIds) {
      try {
        const remainingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          thread_id: threadId
        });

        if (remainingMessages.length === 0) {
          await base44.asServiceRole.entities.EmailThread.delete(threadId);
          deletedThreads++;
          console.log(`Deleted empty thread ${threadId}`);
        } else {
          console.log(`Thread ${threadId} still has ${remainingMessages.length} messages, keeping it`);
        }
      } catch (err) {
        console.error(`Failed to process thread ${threadId}:`, err.message);
      }
    }

    console.log('Cleanup complete');
    return Response.json({
      success: true,
      deletedMessages,
      deletedThreads,
      message: `Deleted ${deletedMessages} Wix messages and ${deletedThreads} empty threads`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});