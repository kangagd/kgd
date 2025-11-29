import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_thread_id, project_id } = await req.json();

    if (!email_thread_id) {
      return Response.json({ error: 'email_thread_id is required' }, { status: 400 });
    }

    // Fetch the email thread with AI insights
    const threads = await base44.asServiceRole.entities.EmailThread.filter({ id: email_thread_id });
    if (!threads || threads.length === 0) {
      return Response.json({ error: 'Email thread not found' }, { status: 404 });
    }
    const thread = threads[0];

    // Check if AI insights exist
    if (!thread.ai_suggested_project_fields && !thread.ai_summary) {
      return Response.json({ 
        error: 'No AI insights found for this thread. Please generate insights first.',
        needs_analysis: true
      }, { status: 400 });
    }

    const suggestions = thread.ai_suggested_project_fields || {};

    // If project_id provided, fetch the project's current fields
    let currentProjectFields = null;
    if (project_id) {
      const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
      if (projects.length > 0) {
        const project = projects[0];
        currentProjectFields = {
          title: project.title,
          description: project.description,
          project_type: project.project_type,
          customer_name: project.customer_name,
          customer_email: project.customer_email,
          customer_phone: project.customer_phone,
          address_full: project.address_full,
          status: project.status
        };
      }
    }

    // Map AI suggestions to project field format
    const suggestedProjectFields = {
      title: suggestions.suggested_title || null,
      description: suggestions.suggested_description || null,
      project_type: suggestions.suggested_project_type || null,
      customer_name: suggestions.suggested_customer_name || null,
      customer_email: suggestions.suggested_customer_email || null,
      customer_phone: suggestions.suggested_customer_phone || null,
      address_full: suggestions.suggested_address || null,
      suggested_products: suggestions.suggested_products || [],
      suggested_priority: suggestions.suggested_priority || 'Normal'
    };

    // Return the comparison data for the UI
    return Response.json({
      success: true,
      email_thread: {
        id: thread.id,
        subject: thread.subject,
        from_address: thread.from_address,
        ai_summary: thread.ai_summary,
        ai_key_points: thread.ai_key_points,
        ai_analyzed_at: thread.ai_analyzed_at
      },
      current_project_fields: currentProjectFields,
      suggested_project_fields: suggestedProjectFields,
      // These are the raw suggestions in case UI needs them
      raw_suggestions: suggestions
    });

  } catch (error) {
    console.error('Error applying email insights:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});