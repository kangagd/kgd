import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('Starting audit...');

    // Count EmailThread records with pagination (limit to avoid timeout)
    try {
      const threadResult = await base44.asServiceRole.entities.EmailThread.filter({}, undefined, 1000);
      console.log('Thread count:', threadResult?.length || 0);
      
      const messageResult = await base44.asServiceRole.entities.EmailMessage.filter({}, undefined, 1000);
      console.log('Message count:', messageResult?.length || 0);

      return Response.json({
        status: 'audit_complete',
        emailThread_count: threadResult?.length || 0,
        emailMessage_count: messageResult?.length || 0,
        message: `Found ${threadResult?.length || 0} EmailThreads and ${messageResult?.length || 0} EmailMessages. Ready to delete.`
      });
    } catch (err) {
      console.error('Audit error:', err.message);
      throw err;
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});