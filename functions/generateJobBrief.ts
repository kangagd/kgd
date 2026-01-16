import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, mode = 'auto' } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id required' }, { status: 400 });
    }

    // Fetch job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Apply guardrails for AUTO mode
    if (mode === 'auto') {
      // If locked or marked manual, skip
      if (job.job_brief_locked === true || job.job_brief_source === 'manual') {
        return Response.json({
          success: true,
          skipped: true,
          reason: 'manual_locked'
        });
      }

      // Cooldown: if generated within last 10 minutes, skip
      if (job.job_brief_last_generated_at) {
        const lastGenTime = new Date(job.job_brief_last_generated_at).getTime();
        const now = new Date().getTime();
        const tenMinutesMs = 10 * 60 * 1000;
        if (now - lastGenTime < tenMinutesMs) {
          return Response.json({
            success: true,
            skipped: true,
            reason: 'cooldown'
          });
        }
      }

      // If brief exists and not empty, skip (unless it's still AI)
      if (job.job_brief && job.job_brief.trim()) {
        if (job.job_brief_source !== 'ai') {
          return Response.json({
            success: true,
            skipped: true,
            reason: 'non_empty_manual'
          });
        }
      }
    }

    // Build context for AI
    let context = `Job #${job.job_number}
Customer: ${job.customer_name}
Type: ${job.job_type_name || 'General'}
Product: ${job.product || 'N/A'}
Address: ${job.address_full || 'N/A'}`;

    // If has project, fetch and add
    if (job.project_id) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(job.project_id);
        if (project) {
          context += `
Project #${project.project_number}: ${project.title}
Stage: ${project.status}
Special Requirements: ${project.special_requirements || 'None'}`;
        }
      } catch (err) {
        console.error('Error fetching project:', err);
      }
    }

    // Call AI to generate brief
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a field service brief generator. Create a concise job brief for a technician using this information:

${context}

Format your response EXACTLY as follows with no additional text:
Purpose: [one-line purpose of the visit]
What to do today:
- [bullet point 1]
- [bullet point 2]
- [bullet point 3]
Bring/expect:
- [item 1]
- [item 2]
Commercial: [one-line commercial note]

Keep it brief and actionable.`,
      add_context_from_internet: false
    });

    const briefText = aiResponse.trim();

    // Save to job
    await base44.asServiceRole.entities.Job.update(job_id, {
      job_brief: briefText,
      job_brief_source: 'ai',
      job_brief_last_generated_at: new Date().toISOString(),
      job_brief_locked: false
    });

    return Response.json({
      success: true,
      skipped: false,
      job_id,
      job_brief: briefText,
      job_brief_source: 'ai',
      job_brief_last_generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating job brief:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});