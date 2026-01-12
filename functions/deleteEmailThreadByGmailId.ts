import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmail_thread_id } = await req.json();

    if (!gmail_thread_id) {
      return Response.json({ error: 'gmail_thread_id required' }, { status: 400 });
    }

    // Find and delete the thread
    const threads = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id
    });

    if (threads.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const threadId = threads[0].id;

    // Hard delete the thread (also deletes related messages via cascade)
    await base44.asServiceRole.entities.EmailThread.delete(threadId);

    return Response.json({ 
      success: true, 
      deleted_thread_id: threadId,
      message: 'Thread hard-deleted. Ready to re-sync.' 
    });
  } catch (error) {
    console.error('Delete thread error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});