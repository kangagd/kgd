import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Get project details
    const project = await base44.asServiceRole.entities.Project.get(projectId);
    
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get customer email
    const customerEmail = project.customer_email;
    
    if (!customerEmail) {
      return Response.json({ 
        success: false, 
        message: 'No customer email found on project' 
      });
    }

    console.log(`Searching Gmail for emails with: ${customerEmail}`);

    // Search Gmail history for this email address
    const searchResult = await base44.asServiceRole.functions.invoke('searchGmailHistory', {
      query: customerEmail,
      maxResults: 50
    });

    if (!searchResult.data?.success) {
      return Response.json({ 
        success: false, 
        message: 'Gmail search failed',
        error: searchResult.data?.error 
      });
    }

    const foundThreads = searchResult.data.threads || [];
    console.log(`Found ${foundThreads.length} threads from Gmail`);

    let linkedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each thread
    for (const gmailThread of foundThreads) {
      try {
        // Check if EmailThread already exists
        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: gmailThread.gmail_thread_id
        });

        let threadId;

        if (existingThreads.length > 0) {
          threadId = existingThreads[0].id;
          
          // Check if already linked to this project
          if (existingThreads[0].project_id === projectId) {
            console.log(`Thread ${gmailThread.gmail_thread_id} already linked to project`);
            skippedCount++;
            continue;
          }
        } else {
          // Create new EmailThread entity
          const newThread = await base44.asServiceRole.entities.EmailThread.create({
            gmail_thread_id: gmailThread.gmail_thread_id,
            subject: gmailThread.subject || 'No Subject',
            from_address: gmailThread.from_address,
            to_addresses: gmailThread.to_addresses || [],
            last_message_date: gmailThread.last_message_date,
            last_message_snippet: gmailThread.snippet,
            message_count: gmailThread.message_count || 1
          });
          threadId = newThread.id;
          console.log(`Created new EmailThread: ${threadId}`);
        }

        // Link thread to project
        await base44.asServiceRole.functions.invoke('linkEmailThreadToProject', {
          threadId,
          projectId
        });

        linkedCount++;
        console.log(`Linked thread ${gmailThread.gmail_thread_id} to project ${projectId}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error processing thread ${gmailThread.gmail_thread_id}:`, error);
        errorCount++;
        errors.push({
          gmail_thread_id: gmailThread.gmail_thread_id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      customerEmail,
      foundThreads: foundThreads.length,
      linkedCount,
      skippedCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in autoLinkProjectEmails:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});