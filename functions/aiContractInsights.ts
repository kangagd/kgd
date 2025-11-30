import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { contract_id } = await req.json();
        if (!contract_id) return Response.json({ error: 'Missing contract_id' }, { status: 400 });

        // 1. Fetch Data
        const contract = await base44.asServiceRole.entities.Contract.get(contract_id);
        if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });

        // Fetch recent jobs for this contract
        const jobs = await base44.asServiceRole.entities.Job.filter({ 
            contract_id: contract_id,
            created_date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() } // Last 90 days
        });

        // Fetch organization name if needed (might be in contract or cached)
        let orgName = "the organization";
        if (contract.organisation_id) {
            const org = await base44.asServiceRole.entities.Organisation.get(contract.organisation_id);
            if (org) orgName = org.name;
        }

        // Prepare context summary
        const jobSummary = jobs.map(j => ({
            status: j.status,
            type: j.job_type,
            customer: j.customer_name,
            outcome: j.outcome,
            sla_breach: j.sla_due_at && new Date(j.completed_date || Date.now()) > new Date(j.sla_due_at) ? "Yes" : "No",
            issue: j.overview || j.description || "N/A"
        }));

        const prompt = `
        Analyze the following contract performance data for ${orgName}.
        Contract Name: ${contract.name}
        Contract Type: ${contract.contract_type}
        
        Recent Jobs Data (Last 90 days, ${jobs.length} jobs):
        ${JSON.stringify(jobSummary, null, 2)}

        Please generate insights in the following JSON structure:
        {
            "summary": "Executive summary of performance, SLA compliance, and general health.",
            "high_risk_stations": ["List of customer names/stations with frequent issues or high costs"],
            "common_issues": ["List of recurring technical issues or failure patterns"],
            "recommended_actions": ["List of specific actions to improve performance or reduce risk"]
        }
        Keep the tone professional and actionable.
        `;

        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    summary: { type: "string" },
                    high_risk_stations: { type: "array", items: { type: "string" } },
                    common_issues: { type: "array", items: { type: "string" } },
                    recommended_actions: { type: "array", items: { type: "string" } }
                }
            }
        });

        const insights = llmRes.data;

        // 2. Update Contract
        await base44.asServiceRole.entities.Contract.update(contract_id, {
            ai_insights: insights,
            insights_generated_at: new Date().toISOString()
        });

        return Response.json({ success: true, insights });

    } catch (error) {
        console.error("AI Contract Insights Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});