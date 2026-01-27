import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { computeVisitDelta } from './shared/computeVisitDelta.js';
import { getJobTypePromptBlock } from './shared/jobTypeBriefPrompts.js';

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
     let project = null;
     if (job.project_id) {
       try {
         project = await base44.asServiceRole.entities.Project.get(job.project_id);
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

     // Compute what changed since last visit (if any)
     let deltaSection = '';
     try {
       let priorVisit = null;
       if (job.project_id) {
         // Fetch visits to find the most recent one before this job
         const visits = await base44.asServiceRole.entities.Visit.filter({ project_id: job.project_id }, '-created_date', 100);
         if (visits && visits.length > 0) {
           priorVisit = visits[0]; // Most recent
         }
       }

       const deltas = computeVisitDelta(job, project, priorVisit, []);
       if (deltas.length > 0) {
         deltaSection = `\n\nWHAT CHANGED SINCE LAST VISIT:\n${deltas.map(d => `- ${d}`).join('\n')}\n`;
       } else if (priorVisit) {
         deltaSection = `\n\nWHAT CHANGED SINCE LAST VISIT:\nNo material changes detected.\n`;
       } else {
         deltaSection = `\n\nWHAT CHANGED SINCE LAST VISIT:\nNo prior visits recorded. Confirm unknowns onsite.\n`;
       }
     } catch (err) {
       // If delta computation fails, continue without it
       console.error('[generateJobBrief] Delta computation failed:', err);
     }

     context += deltaSection;

     // Add quote and invoice status to context
     if (job.project_id) {
       try {
         // Fetch quotes linked to the project
         const quotes = await base44.asServiceRole.entities.Quote.filter({ project_id: job.project_id }, '-created_date', 5);
         if (quotes && quotes.length > 0) {
           const latestQuote = quotes[0];
           context += `\n\nQUOTE STATUS: ${latestQuote.status || 'Unknown'}\n`;
           if (latestQuote.total) {
             context += `Quote Amount: $${latestQuote.total}\n`;
           }
         }

         // Fetch invoices linked to the project
         const invoices = await base44.asServiceRole.entities.Invoice.filter({ project_id: job.project_id }, '-created_date', 5);
         if (invoices && invoices.length > 0) {
           const latestInvoice = invoices[0];
           context += `\nINVOICE STATUS: ${latestInvoice.status || 'Unknown'}\n`;
           if (latestInvoice.total) {
             context += `Invoice Amount: $${latestInvoice.total}\n`;
           }
         }
       } catch (err) {
         // Continue without quote/invoice if fetch fails
         console.error('[generateJobBrief] Quote/Invoice fetch failed:', err);
       }
     }

    // Get job-type specific prompt block
    const jobTypeBlock = getJobTypePromptBlock(job.job_type_name || job.job_type);

    const prompt = `You are generating a technician-ready JOB BRIEF for KangarooGD.

CRITICAL: Job Type defines the lens. Everything below must be interpreted through these MANDATORY rules:

${jobTypeBlock}

CONTEXT FOR THIS BRIEF:
${context}

OUTPUT FORMAT (HTML ONLY, no markdown):

<p><strong>Job Type Context:</strong> [1–3 sentences: why this visit exists]</p>

<p><strong>What changed since last visit:</strong></p>
<ul>
<li>...</li>
</ul>

<p><strong>What you are doing today:</strong></p>
<ul>
<li>...</li>
</ul>

<p><strong>What's already been done:</strong></p>
<ul>
<li>...</li>
</ul>

<p><strong>Important notes & constraints:</strong></p>
<ul>
<li>...</li>
</ul>

<p><strong>Commercial status:</strong><br/>Quote: [status]. Invoice: [status]. Instruction: [Proceed / Hold / Call office].</p>

<p><strong>What to confirm / watch out for:</strong></p>
<ul>
<li>...</li>
</ul>

<p><strong>If something doesn't match:</strong><br/>Pause work and contact the office with photos and notes.</p>

Keep it concise and actionable. Return ONLY the HTML, no markdown code fences.`;

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