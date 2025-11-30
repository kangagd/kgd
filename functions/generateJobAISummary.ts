import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { job_id } = await req.json();
        if (!job_id) return Response.json({ error: 'Job ID required' }, { status: 400 });

        // 1. Fetch Context
        const job = await base44.asServiceRole.entities.Job.get(job_id);
        if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

        let project = null;
        if (job.project_id) {
            try { project = await base44.asServiceRole.entities.Project.get(job.project_id); } catch(e) {}
        }

        // Fetch parts
        const parts = await base44.asServiceRole.entities.Part.filter({ project_id: job.project_id }); // Rough filter
        // Filter strictly related parts if needed, but project context is good

        // Fetch previous summaries
        const previousSummaries = await base44.asServiceRole.entities.JobSummary.filter({ job_id: job_id }, '-created_date', 3);

        // Construct Prompt
        let context = `
        JOB DETAILS:
        Type: ${job.job_type || job.job_type_name}
        Product: ${job.product}
        Description: ${job.overview || job.notes || 'N/A'}
        Address: ${job.address_full}
        Customer: ${job.customer_name}
        
        PROJECT CONTEXT:
        Title: ${project?.title || 'N/A'}
        Description: ${project?.description || 'N/A'}
        Notes: ${project?.notes || 'N/A'}

        PARTS:
        ${parts.map(p => `- ${p.category}: ${p.status} (${p.location})`).join('\n')}

        PREVIOUS VISITS:
        ${previousSummaries.map(s => `- ${s.technician_name}: ${s.overview || s.outcome}`).join('\n')}
        `;

        const prompt = `
        You are an AI assistant for field technicians. 
        Generate a concise briefing for the technician about to start this job.
        
        Based on the context below, provide:
        1. A concise summary paragraph (hazards, access, specific instructions).
        2. A list of "Key Items" (tools, specific parts, warnings).

        CONTEXT:
        ${context}

        Output JSON format:
        {
            "ai_summary": "string",
            "ai_key_items": ["string", "string"]
        }
        `;

        // 2. Generate
        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    ai_summary: { type: "string" },
                    ai_key_items: { type: "array", items: { type: "string" } }
                }
            }
        });

        const result = llmRes.data || {};

        // 3. Save to Job Entity (Active Context)
        const updateData = {
            ai_summary: result.ai_summary,
            ai_key_items: result.ai_key_items,
            ai_generated_at: new Date().toISOString()
        };

        await base44.asServiceRole.entities.Job.update(job_id, updateData);

        // 4. Log Activity
        await base44.asServiceRole.entities.ChangeHistory.create({
            job_id: job_id,
            field_name: "AI Summary",
            old_value: "N/A",
            new_value: "Generated",
            changed_by: user.email,
            changed_by_name: user.full_name || user.email
        });

        return Response.json({ success: true, data: updateData });

    } catch (error) {
        console.error("Generate AI Summary Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});