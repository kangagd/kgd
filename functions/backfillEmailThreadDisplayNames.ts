import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Fetching all email threads with assignments...');
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const assignedThreads = allThreads.filter(t => t.assigned_to && !t.is_deleted);

    console.log(`Found ${assignedThreads.length} assigned threads`);

    if (assignedThreads.length === 0) {
      return Response.json({
        success: true,
        message: 'No assigned threads to update',
        threadsUpdated: 0
      });
    }

    // Get all users to build a lookup map
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.email] = u.display_name || u.full_name;
    });

    let updatedCount = 0;
    const results = [];

    for (const thread of assignedThreads) {
      try {
        const displayName = userMap[thread.assigned_to];
        
        if (!displayName) {
          console.log(`No user found for ${thread.assigned_to}`);
          continue;
        }

        // Only update if the name is different
        if (thread.assigned_to_name !== displayName) {
          await base44.asServiceRole.entities.EmailThread.update(thread.id, {
            assigned_to_name: displayName
          });

          updatedCount++;
          results.push({
            thread_id: thread.id,
            subject: thread.subject,
            old_name: thread.assigned_to_name,
            new_name: displayName
          });

          console.log(`Updated thread ${thread.id}: ${thread.assigned_to_name} -> ${displayName}`);
        }
      } catch (error) {
        console.error(`Error updating thread ${thread.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      threadsChecked: assignedThreads.length,
      threadsUpdated: updatedCount,
      results: results.slice(0, 20) // Return first 20 for brevity
    });

  } catch (error) {
    console.error('Error in backfillEmailThreadDisplayNames:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});