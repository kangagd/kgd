import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { job_id } = await req.json();
        if (!job_id) return Response.json({ error: 'Missing job_id' }, { status: 400 });

        // 1. Fetch Data
        // Use Promise.all for efficiency
        const jobPromise = base44.asServiceRole.entities.Job.get(job_id);
        const partsPromise = base44.asServiceRole.entities.Part.filter({ linked_logistics_jobs: job_id });
        const summariesPromise = base44.asServiceRole.entities.JobSummary.filter({ job_id: job_id });
        
        const [job, parts, summaries] = await Promise.all([jobPromise, partsPromise, summariesPromise]);
        
        if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

        let project = null;
        let customer = null;
        
        // Fetch Project & Customer
        if (job.project_id) {
            project = await base44.asServiceRole.entities.Project.get(job.project_id);
        }
        if (job.customer_id) {
            customer = await base44.asServiceRole.entities.Customer.get(job.customer_id);
        }

        // 2. Construct Context for LLM
        const context = {
            job: {
                type: job.job_type || job.job_category,
                description: job.overview || job.description || "No description provided",
                notes: job.notes,
                address: job.address_full || job.address,
                scheduled: `${job.scheduled_date} ${job.scheduled_time || ''}`
            },
            project: project ? {
                title: project.title,
                description: project.description,
                initial_notes: project.initial_notes,
                doors: project.doors
            } : null,
            customer: customer ? {
                name: customer.name,
                type: customer.customer_type,
                notes: customer.notes
            } : null,
            parts: parts.map(p => `${p.item} (${p.status}) - Loc: ${p.location}`).join(', '),
            history: summaries.map(s => `Visit on ${s.check_in_time}: ${s.overview}. Issues: ${s.issues_found}`).join('\n')
        };

        const prompt = `
        You are an expert field technician assistant. Create a concise, actionable briefing for the technician assigned to this job.
        Focus on:
        1. **Site Risks/Access**: Any gate codes, dogs, or access issues mentioned in notes.
        2. **Scope**: Exactly what needs to be done.
        3. **Materials**: What parts are required and their status.
        4. **History**: If this is a return visit, what happened last time?
        5. **Measurements**: Any door specs if available.

        Data:
        ${JSON.stringify(context, null, 2)}

        Output format: Just the briefing text. Use markdown bullet points.
        `;

        // 3. Invoke LLM
        // Note: Using InvokeLLM from Core integration
        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            // Optional: add_context_from_internet: false // Not needed for internal job data
        });

        // The integration returns a string directly if no json schema is provided
        const summaryText = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);

        // 4. Update Entities
        const now = new Date().toISOString();
        
        // Update Job
        await base44.asServiceRole.entities.Job.update(job_id, {
            ai_summary: summaryText,
            ai_last_generated_at: now
        });

        // Create Cache
        await base44.asServiceRole.entities.AIJobCache.create({
            job_id: job_id,
            generated_at: now,
            summary_text: summaryText,
            version: 'v1'
        });

        return Response.json({ success: true, summary: summaryText });

    } catch (error) {
        console.error("Generate AI Summary Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});