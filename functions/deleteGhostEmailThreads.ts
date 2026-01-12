import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('Starting ghost thread detection...');

    // Find all threads from jesseharris1403@gmail.com
    const ghostThreads = await base44.asServiceRole.entities.EmailThread.filter({
      from_address: 'jesseharris1403@gmail.com'
    });
    
    console.log(`Found ${ghostThreads.length} threads from jesseharris1403@gmail.com`);

    if (ghostThreads.length === 0) {
      return Response.json({
        status: 'no_ghosts',
        message: 'No threads found from jesseharris1403@gmail.com'
      });
    }

    // Get Gmail access token
    const currentUser = await base44.auth.me();
    if (!currentUser?.gmail_access_token) {
      return Response.json({
        error: 'Gmail access token not available'
      }, { status: 400 });
    }

    // Validate each thread against Gmail
    const validationResults = [];
    const ghostIds = [];

    for (const thread of ghostThreads) {
      try {
        // Try to fetch the thread from Gmail
        const gmailResponse = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/threads/${thread.gmail_thread_id}`,
          {
            headers: { 'Authorization': `Bearer ${currentUser.gmail_access_token}` }
          }
        );

        if (gmailResponse.status === 404) {
          // Thread doesn't exist in Gmail - it's a ghost
          console.log(`Ghost detected: ${thread.id} (Gmail ID: ${thread.gmail_thread_id})`);
          ghostIds.push(thread.id);
          validationResults.push({
            thread_id: thread.id,
            gmail_thread_id: thread.gmail_thread_id,
            subject: thread.subject,
            exists_in_gmail: false,
            status: 'GHOST - ready to delete'
          });
        } else if (gmailResponse.ok) {
          // Thread exists in Gmail
          console.log(`Valid thread: ${thread.id}`);
          validationResults.push({
            thread_id: thread.id,
            gmail_thread_id: thread.gmail_thread_id,
            subject: thread.subject,
            exists_in_gmail: true,
            status: 'VALID - will NOT delete'
          });
        } else {
          console.log(`Unknown status for ${thread.id}: ${gmailResponse.status}`);
          validationResults.push({
            thread_id: thread.id,
            gmail_thread_id: thread.gmail_thread_id,
            subject: thread.subject,
            exists_in_gmail: null,
            status: `UNKNOWN - Gmail returned ${gmailResponse.status}`
          });
        }
      } catch (err) {
        console.error(`Error validating thread ${thread.id}:`, err.message);
        validationResults.push({
          thread_id: thread.id,
          gmail_thread_id: thread.gmail_thread_id,
          subject: thread.subject,
          exists_in_gmail: null,
          status: `ERROR - ${err.message}`
        });
      }
    }

    console.log(`Found ${ghostIds.length} confirmed ghost threads`);

    return Response.json({
      status: 'validation_complete',
      total_threads_from_sender: ghostThreads.length,
      ghost_threads_found: ghostIds.length,
      valid_threads: validationResults.filter(v => v.exists_in_gmail === true).length,
      validation_results: validationResults,
      ghost_ids_to_delete: ghostIds,
      message: `Validation complete. Found ${ghostIds.length} ghost threads that don't exist in Gmail. Ready to delete if confirmed.`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});