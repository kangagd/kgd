import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { thread_id } = await req.json();

    if (!thread_id) {
      return Response.json({ error: 'thread_id required' }, { status: 400 });
    }

    // Get the merged thread
    const thread = await base44.asServiceRole.entities.EmailThread.get(thread_id);
    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get all messages in this thread
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({
      thread_id: thread_id
    });

    if (messages.length <= 1) {
      return Response.json({ 
        message: 'Thread has only 1 message, nothing to split',
        split_count: 0 
      });
    }

    console.log(`Splitting thread ${thread_id} with ${messages.length} messages`);

    // Keep first message in original thread, split rest into new threads
    const splitCount = messages.length - 1;
    
    for (let i = 1; i < messages.length; i++) {
      const msg = messages[i];
      
      try {
        // Create new thread for this message
        const newThread = await base44.asServiceRole.entities.EmailThread.create({
          subject: thread.subject,
          gmail_thread_id: `${thread.gmail_thread_id}-split-${i}`, // Unique to prevent re-merging
          from_address: msg.from_address,
          to_addresses: msg.to_addresses || [],
          last_message_date: msg.sent_at,
          last_message_snippet: msg.body_text?.substring(0, 100) || msg.body_html?.substring(0, 100) || '',
          source_type: 'wix_enquiry',
          message_count: 1,
          priority: thread.priority,
          // Preserve any customer/project links from original
          customer_id: thread.customer_id,
          customer_name: thread.customer_name,
          project_id: thread.project_id,
          project_number: thread.project_number,
          project_title: thread.project_title
        });

        // Move message to new thread
        await base44.asServiceRole.entities.EmailMessage.update(msg.id, {
          thread_id: newThread.id
        });

        console.log(`Moved message ${msg.id} to new thread ${newThread.id}`);
      } catch (err) {
        console.error(`Failed to split message ${msg.id}:`, err.message);
      }
    }

    // Update original thread message count
    await base44.asServiceRole.entities.EmailThread.update(thread_id, {
      message_count: 1,
      source_type: 'wix_enquiry'
    });

    return Response.json({ 
      message: `Thread successfully split into ${messages.length} separate threads`,
      split_count: splitCount,
      total_threads: messages.length
    });

  } catch (error) {
    console.error('Unthread error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});