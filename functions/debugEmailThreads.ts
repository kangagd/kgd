import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { search_email } = await req.json();
    
    // Get all email threads
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();

    // If search_email provided, find threads from that sender
    if (search_email) {
      const normalized = search_email.toLowerCase().trim();
      const matches = allThreads.filter(t => {
        if (!t.from_address) return false;
        const match = t.from_address.match(/<(.+?)>/);
        const extracted = match ? match[1] : t.from_address;
        return extracted.toLowerCase().trim() === normalized;
      });
      
      return Response.json({
        search_email,
        found_count: matches.length,
        matches: matches.map(t => ({
          id: t.id,
          subject: t.subject,
          from_address: t.from_address
        }))
      });
    }

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