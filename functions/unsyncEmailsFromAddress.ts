/**
 * unsyncEmailsFromAddress - Delete all synced emails from a specific address
 * Allows re-syncing with proper linking
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const bodyText = await req.text();
    const { email_address } = JSON.parse(bodyText || '{}');

    if (!email_address) {
      return Response.json({ error: 'Missing email_address' }, { status: 400 });
    }

    console.log(`[unsyncEmailsFromAddress] Starting unsync for ${email_address}`);

    // Get all threads and filter with flexible matching (in case from_address includes name)
    const allThreads = await base44.asServiceRole.entities.EmailThread.list(null, 1000);
    const threads = allThreads.filter(t => 
      t.from_address && t.from_address.toLowerCase().includes(email_address.toLowerCase())
    );

    console.log(`[unsyncEmailsFromAddress] Found ${threads.length} threads from ${email_address}`);

    let messagesDeleted = 0;
    let threadsDeleted = 0;

    // Delete all messages from these threads
    for (const thread of threads) {
      const messages = await base44.asServiceRole.entities.EmailMessage.filter({
        thread_id: thread.id
      });

      console.log(`[unsyncEmailsFromAddress] Deleting ${messages.length} messages from thread ${thread.id}`);

      for (const msg of messages) {
        await base44.asServiceRole.entities.EmailMessage.delete(msg.id);
        messagesDeleted++;
      }
    }

    // Delete all threads
    for (const thread of threads) {
      await base44.asServiceRole.entities.EmailThread.delete(thread.id);
      threadsDeleted++;
    }

    console.log(`[unsyncEmailsFromAddress] Deleted ${threadsDeleted} threads and ${messagesDeleted} messages`);

    return Response.json({
      success: true,
      email_address,
      threads_deleted: threadsDeleted,
      messages_deleted: messagesDeleted
    });
  } catch (error) {
    console.error(`[unsyncEmailsFromAddress] Error:`, error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});