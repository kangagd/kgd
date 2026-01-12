import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmailThreadId, linkTarget } = await req.json();

    if (!gmailThreadId) {
      return Response.json({ error: 'gmailThreadId is required' }, { status: 400 });
    }

    // Check if thread already exists
    const existingThreads = await base44.entities.EmailThread.filter({
      gmail_thread_id: gmailThreadId
    });

    if (existingThreads.length > 0) {
      return Response.json({
        success: true,
        thread: existingThreads[0],
        message: 'Thread already imported'
      });
    }

    // Fetch the full thread from Gmail API
    const threadResponse = await base44.functions.invoke('gmailHistoricalSearchThreads', {
      query: `rfc822msgid:${gmailThreadId}`,
      pageToken: null,
      maxResults: 1,
      filters: { notImported: true }
    });

    if (!threadResponse.data?.threads || threadResponse.data.threads.length === 0) {
      return Response.json({ error: 'Thread not found in Gmail' }, { status: 404 });
    }

    const gmailThread = threadResponse.data.threads[0];

    // Create EmailThread entity
    const newThread = await base44.entities.EmailThread.create({
      subject: gmailThread.subject || '(no subject)',
      gmail_thread_id: gmailThreadId,
      from_address: gmailThread.from_address || '',
      to_addresses: gmailThread.to_addresses || [],
      last_message_snippet: gmailThread.snippet || '',
      last_message_date: gmailThread.lastMessageAt || new Date().toISOString(),
      message_count: gmailThread.messageCount || 0,
      is_read: false,
      priority: 'Normal'
    });

    // Link to project/job if provided
    if (linkTarget) {
      const updateData = {
        project_id: linkTarget.linkedEntityType === 'project' ? linkTarget.linkedEntityId : undefined,
        job_id: linkTarget.linkedEntityType === 'job' ? linkTarget.linkedEntityId : undefined,
        project_title: linkTarget.linkedEntityType === 'project' ? linkTarget.linkedEntityTitle : undefined,
        job_number: linkTarget.linkedEntityType === 'job' ? linkTarget.linkedEntityTitle : undefined,
        linked_to_project_at: new Date().toISOString(),
        linked_to_project_by: user.email
      };

      await base44.entities.EmailThread.update(newThread.id, updateData);
    }

    return Response.json({
      success: true,
      thread: newThread,
      message: 'Thread imported successfully'
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({
      error: error.message || 'Failed to import thread',
      details: error.toString()
    }, { status: 500 });
  }
});