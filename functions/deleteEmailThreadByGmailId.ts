import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmail_thread_id, sender_email } = await req.json();

    if (!gmail_thread_id && !sender_email) {
      return Response.json({ error: 'Either gmail_thread_id or sender_email required' }, { status: 400 });
    }

    // Find threads to delete
    let threads = [];
    if (gmail_thread_id) {
      threads = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id
      });
    } else if (sender_email) {
      // Search case-insensitive by extracting email from from_address
      const allThreads = await base44.asServiceRole.entities.EmailThread.list();
      const normalizedEmail = sender_email.toLowerCase().trim();
      
      threads = allThreads.filter(t => {
        if (!t.from_address) return false;
        
        // Extract email from "Name <email@example.com>" or just "email@example.com"
        const match = t.from_address.match(/<(.+?)>/);
        const extractedEmail = match ? match[1] : t.from_address;
        
        return extractedEmail.toLowerCase().trim() === normalizedEmail;
      });
    }

    if (threads.length === 0) {
      return Response.json({ error: 'No threads found', searched_email: sender_email }, { status: 404 });
    }

    // Hard delete all matching threads
    let deleted = 0;
    for (const thread of threads) {
      await base44.asServiceRole.entities.EmailThread.delete(thread.id);
      deleted++;
    }

    return Response.json({ 
      success: true, 
      deleted_count: deleted,
      message: `${deleted} thread(s) hard-deleted. Ready to re-sync.` 
    });
  } catch (error) {
    console.error('Delete thread error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});