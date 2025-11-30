import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { project_id } = await req.json();
        if (!project_id) return Response.json({ error: 'Missing project_id' }, { status: 400 });

        // 1. Fetch All Project Data
        const projectPromise = base44.asServiceRole.entities.Project.get(project_id);
        const jobsPromise = base44.asServiceRole.entities.Job.filter({ project_id: project_id });
        const partsPromise = base44.asServiceRole.entities.Part.filter({ project_id: project_id });
        const quotesPromise = base44.asServiceRole.entities.Quote.filter({ project_id: project_id });
        // Also fetch emails if possible, but might be heavy. Let's check linked thread.
        
        const [project, jobs, parts, quotes] = await Promise.all([
            projectPromise, 
            jobsPromise, 
            partsPromise,
            quotesPromise
        ]);
        
        if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

        let customer = null;
        if (project.customer_id) {
            customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
        }

        // 2. Construct Context
        const context = {
            project: {
                title: project.title,
                description: project.description,
                status: project.status,
                urgency: project.urgency,
                notes: project.notes,
                initial_notes: project.initial_notes,
                type: project.project_type
            },
            customer: customer ? {
                name: customer.name,
                type: customer.customer_type,
                notes: customer.notes
            } : null,
            jobs: jobs.map(j => ({
                type: j.job_type || j.job_category,
                status: j.status,
                scheduled: j.scheduled_date,
                outcome: j.outcome,
                technician: j.assigned_to_name,
                notes: j.completion_notes || j.notes
            })),
            parts: parts.map(p => ({
                item: p.item || p.category,
                status: p.status,
                location: p.location,
                eta: p.eta
            })),
            quotes: quotes.map(q => ({
                status: q.status,
                value: q.value,
                sent: q.sent_at
            }))
        };

        const prompt = `
        You are a project manager assistant. Analyze the following project data and generate a comprehensive status report.
        
        Data:
        ${JSON.stringify(context, null, 2)}

        Provide a response in Markdown format with these exact sections:
        ### 📊 High-Level Summary
        (2-3 sentences on current state)

        ### ⚠️ Risks & Blockers
        (Identify any delays, missing parts, or issues)

        ### ✅ Outstanding Tasks
        (What jobs need to be done? What parts need ordering?)

        ### 📦 Materials Status
        (Summary of parts supply chain)

        ### 🗓️ Scheduling Notes
        (Next steps for scheduling)

        Keep it professional, concise, and actionable.
        `;

        // 3. Invoke LLM
        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: prompt
        });

        const summaryText = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);

        // 4. Update Project
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.Project.update(project_id, {
            ai_project_overview: summaryText,
            ai_last_generated_at: now
        });

        return Response.json({ success: true, summary: summaryText });

    } catch (error) {
        console.error("Generate Project AI Summary Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});