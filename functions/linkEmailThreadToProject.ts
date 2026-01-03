import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_thread_id, project_id, set_as_primary = false } = await req.json();

    if (!email_thread_id || !project_id) {
      return Response.json({ 
        error: 'Missing required fields: email_thread_id and project_id' 
      }, { status: 400 });
    }

    // Load EmailThread
    let emailThread;
    try {
      emailThread = await base44.asServiceRole.entities.EmailThread.get(email_thread_id);
    } catch (error) {
      return Response.json({ error: 'EmailThread not found' }, { status: 404 });
    }

    // Load Project
    let project;
    try {
      project = await base44.asServiceRole.entities.Project.get(project_id);
    } catch (error) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update EmailThread with cached fields
    const threadUpdates = {
      project_id: project.id,
      project_number: project.project_number || null,
      project_title: project.title || null,
      customer_id: project.customer_id || null,
      customer_name: project.customer_name || null,
      organisation_id: project.organisation_id || null,
      organisation_name: project.organisation_name || null,
      linked_to_project_at: new Date().toISOString(),
      linked_to_project_by: user.email
    };

    await base44.asServiceRole.entities.EmailThread.update(email_thread_id, threadUpdates);

    // Optionally set as primary thread on project
    if (set_as_primary && !project.primary_email_thread_id) {
      await base44.asServiceRole.entities.Project.update(project_id, {
        primary_email_thread_id: email_thread_id
      });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('Error in linkEmailThreadToProject:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});