import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all email threads with linked_project_id but no project_id
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const threadsToMigrate = allThreads.filter(t => 
      t.linked_project_id && !t.project_id
    );

    console.log(`Found ${threadsToMigrate.length} threads to migrate`);

    let migrated = 0;
    let failed = 0;
    const errors = [];

    for (const thread of threadsToMigrate) {
      try {
        const updates = {
          project_id: thread.linked_project_id,
          project_title: thread.linked_project_title || null,
          project_number: null // Will be fetched from project if needed
        };

        // Try to fetch project details if we have an ID
        if (thread.linked_project_id) {
          try {
            const project = await base44.asServiceRole.entities.Project.get(thread.linked_project_id);
            if (project) {
              updates.project_number = project.project_number;
              updates.project_title = project.title;
            }
          } catch (e) {
            console.log(`Could not fetch project ${thread.linked_project_id}: ${e.message}`);
          }
        }

        await base44.asServiceRole.entities.EmailThread.update(thread.id, updates);
        migrated++;
        console.log(`Migrated thread ${thread.id} to project ${thread.linked_project_id}`);
      } catch (error) {
        failed++;
        errors.push({
          thread_id: thread.id,
          error: error.message
        });
        console.error(`Failed to migrate thread ${thread.id}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      total: threadsToMigrate.length,
      migrated,
      failed,
      errors: failed > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});