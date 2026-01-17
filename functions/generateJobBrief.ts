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
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Fetch job with service role to ensure we can read all fields
    const job = await base44.asServiceRole.entities.Job.get(job_id);

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // AUTO mode guardrails
    if (mode === 'auto') {
      // Check if manually locked
      if (job.job_brief_locked === true || job.job_brief_source === 'manual') {
        return Response.json({ 
          skipped: true, 
          reason: 'manual_locked',
          message: 'Job brief is manually edited and locked'
        });
      }

      // Check cooldown (10 minutes)
      if (job.job_brief_last_generated_at) {
        const lastGen = new Date(job.job_brief_last_generated_at);
        const now = new Date();
        const diffMinutes = (now - lastGen) / (1000 * 60);
        
        if (diffMinutes < 10) {
          return Response.json({ 
            skipped: true, 
            reason: 'cooldown',
            message: `Cooldown active. Last generated ${Math.floor(diffMinutes)} minutes ago`
          });
        }
      }

      // Check if already has content
      if (job.job_brief && job.job_brief.trim().length > 0) {
        return Response.json({ 
          skipped: true, 
          reason: 'already_present',
          message: 'Job brief already exists'
        });
      }
    }

    // Build context for AI
    let context = `Generate a concise job brief for a technician.\n\n`;
    context += `Job Type: ${job.job_type_name || job.job_type || 'Service'}\n`;
    context += `Customer: ${job.customer_name || 'Unknown'}\n`;
    
    if (job.address_full) {
      context += `Address: ${job.address_full}\n`;
    }

    if (job.product) {
      context += `Product: ${job.product}\n`;
    }

    if (job.additional_info) {
      context += `\nJob Details:\n${job.additional_info}\n`;
    }

    if (job.notes) {
      context += `\nInternal Notes:\n${job.notes}\n`;
    }

    if (job.overview) {
      context += `\nPrevious Work:\n${job.overview}\n`;
    }

    // Fetch project context if available
    if (job.project_id) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(job.project_id);
        if (project) {
          if (project.description) {
            context += `\nProject Description:\n${project.description}\n`;
          }
          if (project.special_requirements) {
            context += `\nSpecial Requirements:\n${project.special_requirements}\n`;
          }
        }
      } catch (err) {
        // Project not found or error - continue without it
      }
    }

    const prompt = `${context}

Create a brief for the technician in this EXACT format (no extra text):

Purpose: [One clear sentence about the main goal]

What to do today:
• [Bullet 1]
• [Bullet 2]
• [Bullet 3]
• [Optional bullet 4-6]

Bring/expect:
• [Equipment or parts needed]
• [What to expect on site]
• [Optional 2-4 bullets total]

Commercial: [One sentence about pricing, quotes, or payment status]

Keep it concise and actionable. No long paragraphs.`;

    // Generate brief using AI
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: false
    });

    // Clean up response
    let jobBrief = aiResponse.trim();
    
    // Remove markdown code fences if present
    jobBrief = jobBrief.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

    // Update job with new brief
    await base44.asServiceRole.entities.Job.update(job_id, {
      job_brief: jobBrief,
      job_brief_source: 'ai',
      job_brief_last_generated_at: new Date().toISOString(),
      job_brief_locked: false
    });

    return Response.json({
      success: true,
      job_brief: jobBrief,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[generateJobBrief] Error:', error);
    return Response.json({ 
      error: 'Failed to generate job brief',
      details: error.message 
    }, { status: 500 });
  }
});