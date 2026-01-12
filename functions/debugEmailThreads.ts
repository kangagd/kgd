import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all email threads
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();

    // Show first 20 threads with their from_address values
    const preview = allThreads.slice(0, 20).map(t => ({
      id: t.id,
      subject: t.subject,
      from_address: t.from_address,
      from_address_length: t.from_address?.length,
      gmail_thread_id: t.gmail_thread_id
    }));

    return Response.json({ 
      total_threads: allThreads.length,
      preview,
      sample_from_addresses: allThreads.slice(0, 5).map(t => t.from_address)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});