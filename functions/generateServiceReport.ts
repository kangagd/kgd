import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await req.json();

    if (!jobId) {
      return Response.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Fetch Job Data
    const job = await base44.entities.Job.get(jobId);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch Project if exists
    let project = null;
    if (job.project_id) {
      try {
        project = await base44.entities.Project.get(job.project_id);
      } catch (e) {}
    }

    // Fetch Photos (with AI tags/notes)
    const photos = await base44.entities.Photo.filter({ job_id: jobId });
    const photoContext = photos.map(p => ({
      url: p.image_url,
      notes: p.notes,
      tags: p.tags,
      product_type: p.product_type
    }));

    // Fetch Parts (supporting context only)
    let parts = [];
    if (job.project_id) {
      const allParts = await base44.entities.Part.filter({ project_id: job.project_id });
      const lineItems = await base44.entities.LineItem.filter({ job_id: jobId });
      if (lineItems.length > 0) {
        parts = lineItems.map(li => `${li.item_name} (Qty: ${li.quantity})`);
      } else {
        parts = allParts.map(p => `${p.category} - ${p.status}`);
      }
    }

    // Build Technician Context Block (PRIMARY SOURCE OF TRUTH)
    const techContextSections = [];

    if (job.overview) {
      techContextSections.push(`OVERVIEW (Technician):\n${job.overview}`);
    }

    if (job.outcome) {
      techContextSections.push(`OUTCOME (Technician):\n${job.outcome}`);
    }

    if (job.additional_info) {
      techContextSections.push(`ADDITIONAL INFO (Technician):\n${job.additional_info}`);
    }

    if (job.communication_with_client) {
      techContextSections.push(`COMMUNICATION WITH CLIENT (Technician):\n${job.communication_with_client}`);
    }

    if (job.next_steps) {
      techContextSections.push(`NEXT STEPS (Technician):\n${job.next_steps}`);
    }

    const technicianSourceOfTruth = techContextSections.length
      ? techContextSections.join("\n\n")
      : "No technician-entered notes were provided.";

    const techNotesUsed = [
      job.overview && "overview",
      job.outcome && "outcome",
      job.additional_info && "additional_info",
      job.communication_with_client && "communication_with_client",
      job.next_steps && "next_steps",
    ].filter(Boolean).join(" + ");
    
    const prompt = `
You are generating a CLIENT-READY SERVICE HANDOVER REPORT
for a professional garage door / shutter company.

CRITICAL RULES:
- The section titled "TECHNICIAN SOURCE OF TRUTH" describes what actually happened on site.
- Your task is to REVIEW, REFINE, and REWRITE the technician's notes.
- DO NOT invent work, issues, or outcomes.
- If information is missing or unclear, say "Not specified by technician"
  and add a clarification question to missing_info_questions.

OUTPUT STYLE (MANDATORY):
- Use BULLET POINTS only (3-6 bullets per section minimum)
- Be DETAILED and SPECIFIC - include measurements, quantities, part names, locations
- Each bullet should be comprehensive and informative
- Use clear, plain English suitable for clients, technicians, and office staff
- No vague statements - provide concrete details from the technician's notes

JOB CONTEXT:
- Job Type: ${job.job_type_name || job.job_type || ""}
- Product: ${job.product || ""}
- Customer: ${job.customer_name || ""}
- Site: ${job.address || job.site_address || ""}

TECHNICIAN SOURCE OF TRUTH:
${technicianSourceOfTruth}

SUPPORTING PHOTOS (reference only):
${JSON.stringify(photoContext, null, 2)}

SUPPORTING PARTS (reference only):
${parts.join(", ") || "None specified"}

STRUCTURE YOUR OUTPUT EXACTLY AS FOLLOWS:

WORK PERFORMED:
- Bullet points summarising what was done on site

ISSUES FOUND:
- Bullet points describing any faults, damage, or concerns identified
- If none were mentioned, state that clearly

RESOLUTION / OUTCOME:
- Bullet points explaining how issues were resolved
- Or what state the system was left in

NEXT STEPS / RECOMMENDATIONS:
- Bullet points outlining follow-up actions or advice
- If none are required, state that clearly

Also return:
- tech_notes_used: which technician fields were referenced
- missing_info_questions: questions if anything was unclear

Do not add sections or extra commentary.
`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          work_performed: {
            type: "array",
            items: { type: "string" }
          },
          issues_found: {
            type: "array",
            items: { type: "string" }
          },
          resolution: {
            type: "array",
            items: { type: "string" }
          },
          next_steps: {
            type: "array",
            items: { type: "string" }
          },
          tech_notes_used: {
            type: "string"
          },
          missing_info_questions: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["work_performed", "issues_found", "resolution", "next_steps", "tech_notes_used", "missing_info_questions"]
      }
    });

    // Ensure tech_notes_used is populated
    if (!llmResponse.tech_notes_used) {
      llmResponse.tech_notes_used = techNotesUsed || "none";
    }

    return Response.json(llmResponse);

  } catch (error) {
    console.error("generateServiceReport error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});