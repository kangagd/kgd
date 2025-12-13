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

    // Collect technician-authored content (highest priority)
    const techSources = [];
    
    if (job.completion_notes) techSources.push({ source: "job.completion_notes", text: job.completion_notes });
    if (job.technician_notes) techSources.push({ source: "job.technician_notes", text: job.technician_notes });
    if (job.internal_notes) techSources.push({ source: "job.internal_notes", text: job.internal_notes });
    if (job.notes) techSources.push({ source: "job.notes (instructions)", text: job.notes });

    // Fetch related entities with graceful failures
    let jobNotes = [];
    try {
      jobNotes = await base44.entities.JobNote?.filter({ job_id: jobId }) || [];
    } catch (e) {}

    let jobComments = [];
    try {
      jobComments = await base44.entities.JobComment?.filter({ job_id: jobId }) || [];
    } catch (e) {}

    let jobMessages = [];
    try {
      jobMessages = await base44.entities.JobMessage?.filter({ job_id: jobId }) || [];
    } catch (e) {}

    let checklistResponses = [];
    try {
      checklistResponses = await base44.entities.ChecklistResponse?.filter({ job_id: jobId }) || [];
    } catch (e) {}

    // Build tech context string
    const techContext = [
      "TECHNICIAN-ENTERED SOURCE OF TRUTH (do not contradict):",
      ...techSources.map(s => `- ${s.source}:\n${s.text}`),
      jobNotes?.length ? `\nJOB NOTES:\n${jobNotes.map(n => `- ${n.created_date || ""} ${n.author_name || ""}: ${n.text || n.note || ""}`).join("\n")}` : "",
      jobComments?.length ? `\nJOB COMMENTS:\n${jobComments.map(c => `- ${c.created_date || ""} ${c.author_name || ""}: ${c.text || c.comment || ""}`).join("\n")}` : "",
      jobMessages?.length ? `\nJOB MESSAGES:\n${jobMessages.map(m => `- ${m.created_date || ""} ${m.sender_name || ""}: ${m.message || m.text || ""}`).join("\n")}` : "",
      checklistResponses?.length ? `\nCHECKLIST / FORM RESPONSES:\n${JSON.stringify(checklistResponses, null, 2)}` : "",
    ].filter(Boolean).join("\n\n");

    const techNotesUsed = [
      ...techSources.map(s => s.source),
      jobNotes?.length ? `JobNote x${jobNotes.length}` : null,
      jobComments?.length ? `JobComment x${jobComments.length}` : null,
      jobMessages?.length ? `JobMessage x${jobMessages.length}` : null,
      checklistResponses?.length ? `ChecklistResponse x${checklistResponses.length}` : null,
    ].filter(Boolean).join(" + ") || "None";

    // Fetch Photos (supporting context only)
    const photos = await base44.entities.Photo.filter({ job_id: jobId });
    const photoContext = photos.map(p => ({
      url: p.image_url,
      notes: p.notes,
      tags: p.tags,
      product_type: p.product_type
    }));

    // Fetch Parts (supporting context only)
    let parts = [];
    const lineItems = await base44.entities.LineItem.filter({ job_id: jobId });
    if (lineItems.length > 0) {
      parts = lineItems.map(li => `${li.item_name} (Qty: ${li.quantity})`);
    } else if (job.project_id) {
      try {
        const allParts = await base44.entities.Part.filter({ project_id: job.project_id });
        parts = allParts.map(p => `${p.category} - ${p.item_name || "Unnamed"} (${p.status}) [project context]`);
      } catch (e) {}
    }

    const prompt = `
You are writing a CLIENT-READY service report for a garage door / shutter business.

CRITICAL INSTRUCTION:
- The "TECHNICIAN-ENTERED SOURCE OF TRUTH" below is the primary input.
- Do NOT invent work performed.
- If details are missing, write "Not specified by technician" and add questions to missing_info_questions.
- Photos/parts are supporting context only - reference them when relevant but do not base the report solely on them.

JOB SUMMARY:
- Type: ${job.job_type_name || job.job_type || "N/A"}
- Product: ${job.product || "N/A"}
- Customer: ${job.customer_name || "N/A"}
- Address/Site: ${job.address_full || job.address || "N/A"}

${techContext}

SUPPORTING PHOTOS CONTEXT:
${photoContext.length > 0 ? JSON.stringify(photoContext, null, 2) : "No photos"}

SUPPORTING PARTS CONTEXT:
${parts.length > 0 ? parts.join(", ") : "None specified"}

Return JSON with:
- work_performed: Rewrite tech notes into a clear narrative for the client. If missing, state "Not specified by technician."
- issues_found: Summarize issues identified. If missing, state "Not specified by technician."
- resolution: How issues were resolved. If missing, state "Not specified by technician."
- next_steps: Include recommendations and what the customer should do. If missing, state "Not specified by technician."
- tech_notes_used: Brief string summary of sources used (will be auto-populated, leave empty is fine)
- missing_info_questions: Array of questions for technician if key details are missing
`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          work_performed: { type: "string" },
          issues_found: { type: "string" },
          resolution: { type: "string" },
          next_steps: { type: "string" },
          tech_notes_used: { type: "string" },
          missing_info_questions: { type: "array", items: { type: "string" } }
        },
        required: ["work_performed", "issues_found", "resolution", "next_steps", "tech_notes_used", "missing_info_questions"]
      }
    });

    // Ensure tech_notes_used is set
    const response = {
      ...llmResponse,
      tech_notes_used: llmResponse.tech_notes_used || techNotesUsed
    };

    return Response.json(response);

  } catch (error) {
    console.error("generateServiceReport error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});