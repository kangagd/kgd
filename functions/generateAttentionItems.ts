import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHash } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id, mode = "persist" } = await req.json();

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'entity_type and entity_id required' }, { status: 400 });
    }

    if (!['job', 'project'].includes(entity_type)) {
      return Response.json({ error: 'entity_type must be job or project' }, { status: 400 });
    }

    // STEP 1: Load context for the specific entity
    let contextData = {};
    
    if (entity_type === 'job') {
      const job = await base44.entities.Job.get(entity_id);
      if (!job) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }

      contextData = {
        entity_type: 'job',
        entity_id: job.id,
        job_number: job.job_number,
        job_type_name: job.job_type_name,
        overview: job.overview,
        outcome: job.outcome,
        next_steps: job.next_steps,
        communication_with_client: job.communication_with_client,
        additional_info: job.additional_info,
        notes: job.notes,
        status: job.status,
        customer_name: job.customer_name
      };

      // Load related project if exists (read-only)
      if (job.project_id) {
        try {
          const project = await base44.entities.Project.get(job.project_id);
          contextData.related_project = {
            title: project.title,
            status: project.status,
            financial_status: project.financial_status
          };
        } catch (e) {
          // Continue without project
        }
      }

      // Load linked emails/messages
      try {
        const messages = await base44.entities.JobMessage.filter({ job_id: entity_id });
        contextData.messages = messages.slice(0, 5).map(m => ({
          content: m.message,
          sender: m.sender_name,
          created_at: m.created_at
        }));
      } catch (e) {
        contextData.messages = [];
      }

      // Load invoice status if exists
      if (job.xero_invoice_id) {
        try {
          const invoice = await base44.entities.XeroInvoice.get(job.xero_invoice_id);
          contextData.invoice_status = {
            status: invoice.status,
            amount_due: invoice.amount_due,
            due_date: invoice.due_date
          };
        } catch (e) {
          // Continue without invoice
        }
      }

    } else if (entity_type === 'project') {
      const project = await base44.entities.Project.get(entity_id);
      if (!project) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }

      contextData = {
        entity_type: 'project',
        entity_id: project.id,
        project_number: project.project_number,
        title: project.title,
        description: project.description,
        notes: project.notes,
        status: project.status,
        financial_status: project.financial_status,
        customer_name: project.customer_name
      };

      // Load jobs within project (read-only)
      try {
        const jobs = await base44.entities.Job.filter({ project_id: entity_id });
        contextData.jobs = jobs.slice(0, 5).map(j => ({
          job_number: j.job_number,
          status: j.status,
          outcome: j.outcome
        }));
      } catch (e) {
        contextData.jobs = [];
      }

      // Load linked emails
      try {
        const messages = await base44.entities.ProjectMessage.filter({ project_id: entity_id });
        contextData.messages = messages.slice(0, 5).map(m => ({
          content: m.message,
          sender: m.sender_name,
          created_at: m.created_at
        }));
      } catch (e) {
        contextData.messages = [];
      }

      // Load invoice status
      if (project.primary_xero_invoice_id) {
        try {
          const invoice = await base44.entities.XeroInvoice.get(project.primary_xero_invoice_id);
          contextData.invoice_status = {
            status: invoice.status,
            amount_due: invoice.amount_due,
            due_date: invoice.due_date
          };
        } catch (e) {
          // Continue without invoice
        }
      }
    }

    // STEP 2: Call AI with STRICT PROMPT
    const aiPrompt = `You are generating Attention Items for a garage door installation and
repair company (KangarooGD).

Your job is to identify ONLY critical information that would change
how a technician or office manager behaves.

Rules:
- Generate 0–3 items only
- If nothing is truly important, return an empty array
- Each item MUST:
  - Be specific to THIS job or project
  - Have direct evidence
  - Be actionable or risk-based

DO NOT generate:
- Best practice reminders
- Installation steps
- Suggestions or recommendations
- Normal operational notes
- Duplicates of obvious job details

Valid triggers include ONLY:
- Access restrictions (keys, codes, unsafe access)
- Payment risk blocking work
- Explicit customer frustration or dispute
- Safety hazards
- Hard blockers that could stop the job

Context data:
${JSON.stringify(contextData, null, 2)}

Output JSON ONLY in this format:

{
  "items": [
    {
      "category": "",
      "audience": "",
      "severity": "",
      "title": "",
      "summary_bullets": ["", ""],
      "evidence_type": "",
      "evidence_entity_id": "",
      "evidence_excerpt": ""
    }
  ]
}`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                audience: { type: "string" },
                severity: { type: "string" },
                title: { type: "string" },
                summary_bullets: { type: "array", items: { type: "string" } },
                evidence_type: { type: "string" },
                evidence_entity_id: { type: "string" },
                evidence_excerpt: { type: "string" }
              }
            }
          }
        }
      }
    });

    let items = aiResponse?.items || [];

    // STEP 3: Post-processing (MANDATORY)
    const validCategories = ["Access & Site", "Payments", "Customer Risk", "Safety", "Hard Blocker"];
    const categoryCount = {};
    const processedItems = [];

    for (const item of items) {
      // Reject items without evidence
      if (!item.evidence_excerpt || item.evidence_excerpt.trim().length === 0) {
        continue;
      }

      // Reject invalid categories
      if (!validCategories.includes(item.category)) {
        continue;
      }

      // Maximum 1 per category
      if (categoryCount[item.category]) {
        continue;
      }

      // Limit summary bullets to 2
      if (item.summary_bullets) {
        item.summary_bullets = item.summary_bullets.slice(0, 2);
      }

      // Truncate evidence excerpt to 160 chars
      if (item.evidence_excerpt && item.evidence_excerpt.length > 160) {
        item.evidence_excerpt = item.evidence_excerpt.substring(0, 157) + '...';
      }

      // Generate fingerprint for deduplication
      const fingerprintString = `${entity_type}|${entity_id}|${item.category}|${item.title.toLowerCase().trim()}`;
      const fingerprint = createHash('sha256').update(fingerprintString).digest('hex');

      // Check for duplicates
      const existing = await base44.entities.AttentionItem.filter({
        fingerprint,
        status: 'open'
      });

      if (existing && existing.length > 0) {
        continue; // Skip duplicate
      }

      processedItems.push({
        ...item,
        entity_type,
        entity_id,
        root_entity_type: entity_type,
        root_entity_id: entity_id,
        status: 'open',
        created_by_type: 'ai',
        created_by_name: 'System AI',
        fingerprint
      });

      categoryCount[item.category] = true;

      // Maximum 3 items total
      if (processedItems.length >= 3) {
        break;
      }
    }

    // STEP 4: Persist if not dry_run
    let created = [];
    if (mode === 'persist') {
      for (const item of processedItems) {
        const createdItem = await base44.entities.AttentionItem.create(item);
        created.push(createdItem);
      }
    }

    return Response.json({
      success: true,
      created_count: mode === 'persist' ? created.length : 0,
      skipped_count: items.length - processedItems.length,
      items: mode === 'dry_run' ? processedItems : created
    });

  } catch (error) {
    console.error('Error generating attention items:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});