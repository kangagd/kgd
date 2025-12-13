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

    // Fetch Parts
    let parts = [];
    if (job.project_id) {
      const allParts = await base44.entities.Part.filter({ project_id: job.project_id });
      // Filter parts linked to this job via linked_logistics_jobs or if we can infer usage
      // Assuming parts used might be relevant. For now, send all project parts as context or try to filter.
      // If line items exist, use those.
      const lineItems = await base44.entities.LineItem.filter({ job_id: jobId });
      if (lineItems.length > 0) {
        parts = lineItems.map(li => `${li.item_name} (Qty: ${li.quantity})`);
      } else {
        parts = allParts.map(p => `${p.category} - ${p.status}`);
      }
    }

    // Fetch previous messages/notes
    // job.notes contains instructions. job.completion_notes might be empty yet.
    
    const prompt = `
    You are an expert field service technician assistant.
    Generate a comprehensive Service Report for the following job.
    
    Job Details:
    - Type: ${job.job_type_name || job.job_type}
    - Product: ${job.product}
    - Description/Notes: ${job.notes}
    - Customer: ${job.customer_name}
    
    Photos Analysis:
    ${JSON.stringify(photoContext, null, 2)}
    
    Parts/Materials Used:
    ${parts.join(', ') || 'None specified'}
    
    Please draft the following sections for the report based on the above data and photos:
    1. Work Performed (Detailed description of tasks completed)
    2. Issues Found (Diagnosis of problems identified)
    3. Resolution (How the issues were resolved)
    4. Next Steps/Recommendations (Any follow-up actions or advice)
    
    Format the output as a JSON object with keys: "work_performed", "issues_found", "resolution", "next_steps".
    The content should be professional, clear, and ready for the client.
    `;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          work_performed: { type: "string" },
          issues_found: { type: "string" },
          resolution: { type: "string" },
          next_steps: { type: "string" }
        },
        required: ["work_performed", "issues_found", "resolution", "next_steps"]
      }
    });

    return Response.json(response);

  } catch (error) {
    console.error("generateServiceReport error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});