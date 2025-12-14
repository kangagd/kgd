import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHash } from 'node:crypto';

// Category normalization function
function normalizeCategory(category) {
  if (!category) return null;
  
  const normalized = category.trim().toLowerCase();
  
  // Hard Blocker variations
  if (['hard blocker', 'blocker', 'critical blocker'].includes(normalized)) {
    return 'Hard Blocker';
  }
  
  // Customer Risk variations
  if (['customer risk', 'customer concern', 'customer sentiment', 'client relations', 'client risk'].includes(normalized)) {
    return 'Customer Risk';
  }
  
  // Access & Site variations
  if (['access', 'access & site', 'site access', 'access and site'].includes(normalized)) {
    return 'Access & Site';
  }
  
  // Payments variations
  if (['payments', 'payment', 'payment risk', 'payments / stop work', 'financial risk'].includes(normalized)) {
    return 'Payments';
  }
  
  // Safety variations
  if (['safety', 'safety risk', 'safety hazard'].includes(normalized)) {
    return 'Safety';
  }
  
  return null; // Invalid category
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id, mode = "persist", strictness = mode === "persist" ? "balanced" : "strict" } = await req.json();

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'entity_type and entity_id required' }, { status: 400 });
    }

    if (!['job', 'project', 'customer'].includes(entity_type)) {
      return Response.json({ error: 'entity_type must be job, project, or customer' }, { status: 400 });
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

      // Load linked emails/messages (increased to 10)
      try {
        const messages = await base44.entities.JobMessage.filter({ job_id: entity_id }, '-created_at');
        contextData.messages = messages.slice(0, 10).map(m => ({
          content: m.message,
          sender: m.sender_name,
          created_at: m.created_at
        }));
      } catch (e) {
        contextData.messages = [];
      }
      
      // Load job emails if available
      try {
        const emails = await base44.entities.ProjectEmail.filter({ job_id: entity_id }, '-created_at');
        contextData.emails = emails.slice(0, 5).map(e => ({
          subject: e.subject,
          from: e.from_address,
          excerpt: e.body_text?.substring(0, 200),
          created_at: e.created_at
        }));
      } catch (e) {
        contextData.emails = [];
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

      // Load linked emails/messages (increased to 10)
      try {
        const messages = await base44.entities.ProjectMessage.filter({ project_id: entity_id }, '-created_at');
        contextData.messages = messages.slice(0, 10).map(m => ({
          content: m.message,
          sender: m.sender_name,
          created_at: m.created_at
        }));
      } catch (e) {
        contextData.messages = [];
      }
      
      // Load project emails if available
      try {
        const emails = await base44.entities.ProjectEmail.filter({ project_id: entity_id }, '-created_at');
        contextData.emails = emails.slice(0, 5).map(e => ({
          subject: e.subject,
          from: e.from_address,
          excerpt: e.body_text?.substring(0, 200),
          created_at: e.created_at
        }));
      } catch (e) {
        contextData.emails = [];
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
    } else if (entity_type === 'customer') {
      const customer = await base44.entities.Customer.get(entity_id);
      if (!customer) {
        return Response.json({ error: 'Customer not found' }, { status: 404 });
      }

      contextData = {
        entity_type: 'customer',
        entity_id: customer.id,
        customer_name: customer.name,
        customer_type: customer.customer_type,
        notes: customer.notes,
        status: customer.status,
        address_full: customer.address_full,
        email: customer.email,
        phone: customer.phone
      };

      // Load related projects (read-only)
      try {
        const projects = await base44.entities.Project.filter({ customer_id: entity_id });
        contextData.projects = projects.slice(0, 5).map(p => ({
          title: p.title,
          status: p.status,
          financial_status: p.financial_status
        }));
      } catch (e) {
        contextData.projects = [];
      }

      // Load related jobs (read-only)
      try {
        const jobs = await base44.entities.Job.filter({ customer_id: entity_id });
        contextData.jobs = jobs.slice(0, 5).map(j => ({
          job_number: j.job_number,
          status: j.status,
          outcome: j.outcome
        }));
      } catch (e) {
        contextData.jobs = [];
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
- Access restrictions (keys, codes, unsafe access) -> category: "Access & Site"
- Payment risk blocking work -> category: "Payments"
- Explicit customer frustration or dispute -> category: "Customer Risk"
- Safety hazards -> category: "Safety"
- Hard blockers that could stop the job -> category: "Hard Blocker"

Context data:
${JSON.stringify(contextData, null, 2)}

Output JSON ONLY in this format:

{
  "items": [
    {
      "category": "Customer Risk",
      "audience": "both",
      "severity": "high",
      "title": "Short factual title",
      "summary_bullets": ["Bullet 1", "Bullet 2"],
      "evidence_type": "project_field",
      "evidence_entity_id": "project_id",
      "evidence_excerpt": "Verbatim quote from notes"
    }
  ]
}

Valid category values: "Access & Site", "Payments", "Customer Risk", "Safety", "Hard Blocker"
Valid audience values: "tech", "office", "both"
Valid severity values: "high", "critical"`;

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
    
    console.log('AI Generated Items:', JSON.stringify(items, null, 2));

    // STEP 3: Post-processing (MANDATORY)
    const validCategories = ["Access & Site", "Payments", "Customer Risk", "Customer Concern", "Safety", "Hard Blocker"];
    const categoryCount = {};
    const processedItems = [];
    const rejectionReasons = [];

    for (const item of items) {
      // Normalize category first
      const originalCategory = item.category;
      item.category = normalizeCategory(item.category);
      
      if (!item.category) {
        rejectionReasons.push({ item: item.title, reason: `Invalid category: ${originalCategory}` });
        continue;
      }
      
      // Handle evidence based on strictness
      if (strictness === "strict") {
        // Strict: Reject if no evidence or empty
        if (!item.evidence_excerpt || item.evidence_excerpt.trim().length === 0) {
          rejectionReasons.push({ item: item.title, reason: 'Missing evidence_excerpt (strict mode)' });
          continue;
        }
      } else {
        // Balanced: Allow shorter excerpts and create fallbacks
        if (!item.evidence_excerpt || item.evidence_excerpt.trim().length < 20) {
          // Try to create a fallback excerpt
          if (item.evidence_type && item.evidence_entity_id) {
            item.evidence_excerpt = `Evidence linked: ${item.evidence_type} (${item.evidence_entity_id.substring(0, 8)})`;
          } else {
            rejectionReasons.push({ item: item.title, reason: 'Evidence too short and no fallback available' });
            continue;
          }
        }
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
      items: mode === 'dry_run' ? processedItems : created,
      strictness_mode: strictness,
      debug: {
        raw_ai_items: items,
        rejection_reasons: rejectionReasons
      }
    });

  } catch (error) {
    console.error('Error generating attention items:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});