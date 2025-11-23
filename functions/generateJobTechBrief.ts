import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, force_regenerate = false } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Check if brief already exists
    const existingBriefs = await base44.asServiceRole.entities.JobTechBrief.filter({ job_id });
    
    if (existingBriefs.length > 0 && !force_regenerate) {
      return Response.json(existingBriefs[0]);
    }

    // Fetch job details
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    const customer = job.customer_id ? await base44.asServiceRole.entities.Customer.get(job.customer_id) : null;
    
    let project = null;
    let jobSummaries = [];
    
    if (job.project_id) {
      project = await base44.asServiceRole.entities.Project.get(job.project_id);
      jobSummaries = await base44.asServiceRole.entities.JobSummary.filter(
        { project_id: job.project_id },
        '-check_out_time',
        3
      );
    }

    // Build context for AI
    let prompt = `Generate a concise technical brief for a field technician. Return ONLY valid JSON with these exact fields (no markdown, no extra text):

{
  "summary": "<ul><li>bullet 1</li><li>bullet 2</li>...</ul>",
  "key_risks_access": "<ul><li>bullet 1</li><li>bullet 2</li>...</ul>",
  "required_parts_tools": "<ul><li>bullet 1</li><li>bullet 2</li>...</ul>",
  "customer_expectations": "<ul><li>bullet 1</li><li>bullet 2</li>...</ul>"
}

**Job Details:**
- Type: ${job.job_type_name || 'General service'}
- Product: ${job.product || 'Not specified'}
- Address: ${job.address_full || job.address || 'Not specified'}
- Scheduled: ${job.scheduled_date || 'TBD'}${job.scheduled_time ? ` at ${job.scheduled_time}` : ''}

**Customer:**
- Name: ${customer?.name || job.customer_name || 'Not specified'}
- Type: ${customer?.customer_type || job.customer_type || 'Standard'}
- Phone: ${customer?.phone || job.customer_phone || 'Not specified'}`;

    if (project) {
      prompt += `\n\n**Project Context:**
- ${project.title}
${project.description ? `- Description: ${project.description}` : ''}
${project.status ? `- Stage: ${project.status}` : ''}`;

      if (project.doors && project.doors.length > 0) {
        prompt += `\n\n**Installation Specs:**`;
        project.doors.forEach((door, idx) => {
          prompt += `\n- Door ${idx + 1}: ${door.height || '?'} × ${door.width || '?'}${door.type ? ` • ${door.type}` : ''}${door.style ? ` • ${door.style}` : ''}`;
        });
      }
    }

    if (jobSummaries.length > 0) {
      prompt += `\n\n**Recent Visit History:**`;
      jobSummaries.slice(0, 2).forEach((visit) => {
        prompt += `\n- ${visit.technician_name}: ${visit.outcome?.replace(/_/g, ' ') || 'Visit completed'}`;
        if (visit.next_steps) {
          const plainText = visit.next_steps.replace(/<[^>]*>/g, '').trim();
          if (plainText) prompt += ` - ${plainText.substring(0, 100)}`;
        }
      });
    }

    if (job.notes) {
      const plainNotes = job.notes.replace(/<[^>]*>/g, '').trim();
      if (plainNotes) {
        prompt += `\n\n**Job Notes:**\n${plainNotes}`;
      }
    }

    prompt += `\n\nGenerate a focused technical brief with:
- Summary: 3-5 key points about what needs to be done
- Key Risks & Access: Safety considerations, site access notes, hazards
- Required Parts & Tools: What to bring (be specific based on job type)
- Customer Expectations: What the customer is expecting, communication tips

Keep each section to 2-4 concise bullet points. Focus on actionable information.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          key_risks_access: { type: "string" },
          required_parts_tools: { type: "string" },
          customer_expectations: { type: "string" }
        }
      }
    });

    // Save or update the brief
    const briefData = {
      job_id,
      summary: response.summary,
      key_risks_access: response.key_risks_access,
      required_parts_tools: response.required_parts_tools,
      customer_expectations: response.customer_expectations,
      generated_by: user.email
    };

    let savedBrief;
    if (existingBriefs.length > 0) {
      savedBrief = await base44.asServiceRole.entities.JobTechBrief.update(
        existingBriefs[0].id,
        briefData
      );
    } else {
      savedBrief = await base44.asServiceRole.entities.JobTechBrief.create(briefData);
    }

    return Response.json(savedBrief);
  } catch (error) {
    console.error('Error generating tech brief:', error);
    return Response.json({ 
      error: 'Failed to generate tech brief', 
      details: error.message 
    }, { status: 500 });
  }
});