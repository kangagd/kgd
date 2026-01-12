import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Count EmailThread records
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const threadCount = allThreads.length;

    // Count EmailMessage records
    const allMessages = await base44.asServiceRole.entities.EmailMessage.list();
    const messageCount = allMessages.length;

    // Show sample of threads
    const sampleThreads = allThreads.slice(0, 5).map(t => ({
      id: t.id,
      subject: t.subject,
      gmail_thread_id: t.gmail_thread_id,
      from_address: t.from_address,
      created_date: t.created_date
    }));

    return Response.json({
      status: 'audit_complete',
      emailThread_count: threadCount,
      emailMessage_count: messageCount,
      sample_threads: sampleThreads,
      message: `Ready to delete ${threadCount} EmailThreads and ${messageCount} EmailMessages. Confirm before proceeding.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});