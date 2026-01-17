import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { job_id, mode = 'auto' } = body;

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Load job as service role
    const job = await base44.asServiceRole.entities.Job.get(job_id);

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // AUTO mode guardrails
    if (mode === 'auto') {
      // Check if locked or manually edited
      if (job.job_brief_locked === true || job.job_brief_source === 'manual') {
        return Response.json({
          success: false,
          skipped: true,
          reason: 'manual_locked',
          job_id
        });
      }

      // Check cooldown (10 minutes)
      if (job.job_brief_last_generated_at) {
        const lastGenerated = new Date(job.job_brief_last_generated_at);
        const now = new Date();
        const diffMinutes = (now - lastGenerated) / 1000 / 60;
        
        if (diffMinutes < 10) {
          return Response.json({
            success: false,
            skipped: true,
            reason: 'cooldown',
            job_id,
            cooldown_remaining_minutes: Math.ceil(10 - diffMinutes)
          });
        }
      }

      // Check if already has content
      if (job.job_brief && job.job_brief.trim().length > 0) {
        return Response.json({
          success: false,
          skipped: true,
          reason: 'already_present',
          job_id
        });
      }
    }

    // Build context for AI
    let context = {
      job_number: job.job_number,
      job_type: job.job_type || job.job_type_name || 'General',
      product: job.product || 'N/A',
      customer_name: job.customer_name,
      address: job.address_full || job.address || 'N/A',
      notes: job.notes || '',
      additional_info: job.additional_info || ''
    };

    // If project exists, add project context
    if (job.project_id) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(job.project_id);
        if (project) {
          context.project_title = project.title;
          context.project_number = project.project_number;
          context.project_type = project.project_type;
          context.project_status = project.status;
          context.project_description = project.description || '';
        }
      } catch (err) {
        console.error('[generateJobBrief] Failed to load project:', err);
      }
    }

    // Generate brief using AI
    const prompt = `Generate a concise job brief for a technician based on this information:

Job #${context.job_number} - ${context.job_type}
Product: ${context.product}
Customer: ${context.customer_name}
Address: ${context.address}
${context.project_title ? `Project: ${context.project_title} (#${context.project_number})` : ''}
${context.project_type ? `Project Type: ${context.project_type}` : ''}
${context.project_status ? `Project Stage: ${context.project_status}` : ''}
${context.notes ? `Notes: ${context.notes}` : ''}
${context.additional_info ? `Details: ${context.additional_info}` : ''}
${context.project_description ? `Project Description: ${context.project_description}` : ''}

Format EXACTLY as follows (no extra text):

Purpose: [1 line explaining the job goal]

What to do today:
• [bullet point]
• [bullet point]
• [bullet point]

Bring/expect:
• [bullet point]
• [bullet point]

Commercial: [1 line about payment/quote status or customer context]

Keep it practical and focused. 3-6 bullets for "What to do", 2-4 bullets for "Bring/expect". No long paragraphs.`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false
    });

    const brief = aiResponse.trim();

    // Save ONLY job_brief fields (never modify other fields)
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Job.update(job_id, {
      job_brief: brief,
      job_brief_source: 'ai',
      job_brief_last_generated_at: now,
      job_brief_locked: false
    });

    return Response.json({
      success: true,
      skipped: false,
      job_id,
      job_brief: brief,
      job_brief_source: 'ai',
      job_brief_last_generated_at: now
    });

  } catch (error) {
    console.error('[generateJobBrief] Error:', error);
    return Response.json({ 
      error: 'Failed to generate job brief',
      details: error.message 
    }, { status: 500 });
  }
});