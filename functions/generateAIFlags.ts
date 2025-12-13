import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const TIER_1_RULES = `
TIER 1 — AI SHOULD SUGGEST FLAGS (Only when 2+ corroborating signals exist)

CRITICAL: All attention messages MUST be under 140 characters.

A) SITE ACCESS CONSTRAINTS
- Repeated mentions of: stairs, narrow access, tight driveway, low headroom, no parking, shared access, strata constraints
- Label: "Site access constraints – review before visit" (type: site_constraint, severity: warning)
- Keep message factual and under 140 chars

B) LOGISTICS DEPENDENCY
- Delivery timing mentioned multiple times
- Job blocked by: supplier, freight, pickup, PO status, third-party trade
- Label: "Job depends on logistics" (type: logistics_dependency, severity: warning)
- Details: "Cannot proceed until parts or delivery are resolved" (under 140 chars)

C) PAYMENT RISK
CRITICAL PAYMENT LOGIC:
- DO NOT suggest payment flag if ANY of these are true:
  * payment_status = "Paid"
  * payment_received = true
  * notes/communication includes: "paid on site", "paid in full", "payment received", "EFT received", "card charged"
  
- ONLY suggest if:
  * requires_payment = true
  * payment_status is empty, pending, or disputed
  * job status is progressing or scheduled

- Label: "Payment not confirmed" (type: payment_hold, severity: warning)
- Details: "Payment has not been recorded for this job" (under 140 chars)

D) URGENCY / EMERGENCY
- After-hours messages
- Words: urgent, stuck, won't close, unsafe, security issue
- Same-day scheduling pressure
- Label: "Urgent service required" (type: technical_risk, severity: critical)
- Keep under 140 chars

E) SAFETY RISK
- Mentions of: heavy doors, unstable structures, damaged brackets, electrical exposure
- Photos tagged as unsafe
- Label: "Safety risk identified" (type: technical_risk, severity: critical)
- Details: Brief summary under 140 chars

REQUIREMENTS:
- ALL labels and details MUST be under 140 characters
- Minimum confidence: 0.65
- Minimum sources: 2
- At least 1 operational source (job, PO, logistics, email)
- Use plain operational language - no speculation
- Must have operational impact

NEVER SUGGEST:
- Client sensitivity, tone, personality flags
- "Difficult client" or subjective assessments
- Anything not backed by factual data
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { entityType, entityId, existingFlags = [] } = await req.json();

    if (!entityType || !entityId) {
      return Response.json({ error: 'entityType and entityId required' }, { status: 400 });
    }

    // Fetch the main entity
    let entity;
    if (entityType === 'job') {
      entity = await base44.asServiceRole.entities.Job.get(entityId);
    } else if (entityType === 'project') {
      entity = await base44.asServiceRole.entities.Project.get(entityId);
    } else if (entityType === 'customer') {
      entity = await base44.asServiceRole.entities.Customer.get(entityId);
    } else {
      return Response.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    // Gather signals from various sources
    const signals = await gatherSignals(base44, entityType, entity);

    // If we have fewer than 2 data sources, don't bother with AI
    if (signals.sourceCount < 2) {
      return Response.json({ 
        success: true, 
        suggestedFlags: [],
        reason: 'Insufficient data sources for AI analysis'
      });
    }

    // Use LLM to analyze signals and suggest flags
    const prompt = buildAnalysisPrompt(entityType, entity, signals);
    
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggested_flags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                label: { type: "string" },
                details: { type: "string" },
                severity: { type: "string" },
                confidence: { type: "number" },
                reasoning: { type: "string" },
                source_refs: { 
                  type: "object",
                  properties: {
                    email_thread_id: { type: "string" },
                    job_id: { type: "string" },
                    note_excerpt: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    });

    // DEDUPLICATION: Check existing flags to prevent duplicates
    const existingKeys = new Set(
      existingFlags
        .filter(f => !f.resolved_at && !f.dismissed_at)
        .map(f => `${f.type}_${f.severity}`)
    );

    // Filter suggestions by confidence and validate
    const validSuggestions = (aiResponse.suggested_flags || [])
      .filter(flag => {
        if (flag.confidence < 0.65) return false;
        
        // CRITICAL: Don't suggest if equivalent flag already exists
        const key = `${flag.type}_${flag.severity}`;
        if (existingKeys.has(key)) return false;
        
        return true;
      })
      .map(flag => ({
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        origin: 'ai_suggested',
        type: flag.type,
        label: flag.label.length > 140 ? flag.label.substring(0, 137) + '...' : flag.label,
        details: flag.details.length > 140 ? flag.details.substring(0, 137) + '...' : flag.details,
        severity: flag.severity,
        confidence: flag.confidence,
        source_refs: flag.source_refs || {},
        created_at: new Date().toISOString(),
        created_by: 'system',
        reasoning: flag.reasoning,
        pinned: false,
        acknowledged_by: []
      }));

    return Response.json({ 
      success: true, 
      suggestedFlags: validSuggestions,
      sourceCount: signals.sourceCount
    });

  } catch (error) {
    console.error('Error generating AI flags:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});

async function gatherSignals(base44, entityType, entity) {
  const signals = {
    notes: [],
    emails: [],
    jobSummaries: [],
    parts: [],
    purchaseOrders: [],
    trades: [],
    photos: [],
    payments: [],
    sourceCount: 0
  };

  try {
    // Gather job-specific signals
    if (entityType === 'job') {
      if (entity.notes) {
        signals.notes.push({ source: 'job_notes', content: entity.notes });
        signals.sourceCount++;
      }
      if (entity.overview) {
        signals.notes.push({ source: 'job_overview', content: entity.overview });
        signals.sourceCount++;
      }
      if (entity.additional_info) {
        signals.notes.push({ source: 'job_info', content: entity.additional_info });
        signals.sourceCount++;
      }

      // Job summaries
      const summaries = await base44.asServiceRole.entities.JobSummary.filter({ job_id: entity.id });
      if (summaries.length > 0) {
        signals.jobSummaries = summaries.map(s => ({
          overview: s.overview,
          issues_found: s.issues_found,
          resolution: s.resolution,
          next_steps: s.next_steps,
          communication_with_client: s.communication_with_client
        }));
        signals.sourceCount++;
      }

      // Linked parts
      if (entity.project_id) {
        const parts = await base44.asServiceRole.entities.Part.filter({ project_id: entity.project_id });
        signals.parts = parts.map(p => ({ status: p.status, notes: p.notes, eta: p.eta }));
        if (parts.length > 0) signals.sourceCount++;
      }

      // Photos
      const photos = await base44.asServiceRole.entities.Photo.filter({ job_id: entity.id });
      signals.photos = photos.map(p => ({ tags: p.tags, notes: p.notes }));
      if (photos.length > 0) signals.sourceCount++;
    }

    // Gather project-specific signals
    if (entityType === 'project') {
      if (entity.description) {
        signals.notes.push({ source: 'project_description', content: entity.description });
        signals.sourceCount++;
      }
      if (entity.notes) {
        signals.notes.push({ source: 'project_notes', content: entity.notes });
        signals.sourceCount++;
      }

      // Project jobs
      const jobs = await base44.asServiceRole.entities.Job.filter({ 
        project_id: entity.id,
        deleted_at: { $exists: false }
      });
      
      for (const job of jobs) {
        if (job.notes) signals.notes.push({ source: `job_${job.job_number}_notes`, content: job.notes });
        if (job.overview) signals.notes.push({ source: `job_${job.job_number}_overview`, content: job.overview });
      }

      if (jobs.length > 0) signals.sourceCount++;

      // Parts and POs
      const parts = await base44.asServiceRole.entities.Part.filter({ project_id: entity.id });
      signals.parts = parts.map(p => ({ 
        status: p.status, 
        notes: p.notes, 
        eta: p.eta,
        location: p.location,
        purchase_order_id: p.purchase_order_id
      }));
      if (parts.length > 0) signals.sourceCount++;

      // Trade requirements
      const trades = await base44.asServiceRole.entities.ProjectTradeRequirement.filter({ 
        project_id: entity.id 
      });
      signals.trades = trades.map(t => ({ 
        trade_type: t.trade_type,
        is_required: t.is_required,
        is_booked: t.is_booked,
        notes: t.notes
      }));
      if (trades.length > 0) signals.sourceCount++;

      // Payment history (admin only)
      if (entity.payments && entity.payments.length > 0) {
        signals.payments = entity.payments;
        signals.sourceCount++;
      }
    }

    // Gather customer-specific signals
    if (entityType === 'customer') {
      if (entity.notes) {
        signals.notes.push({ source: 'customer_notes', content: entity.notes });
        signals.sourceCount++;
      }

      // Customer's projects
      const projects = await base44.asServiceRole.entities.Project.filter({ 
        customer_id: entity.id,
        deleted_at: { $exists: false }
      });
      
      // Check for payment patterns across projects
      const paymentIssues = projects.filter(p => 
        p.financial_status && (
          p.financial_status.toLowerCase().includes('late') ||
          p.financial_status.toLowerCase().includes('overdue')
        )
      );
      
      if (paymentIssues.length >= 2) {
        signals.payments.push({ 
          pattern: 'late_payment', 
          count: paymentIssues.length 
        });
        signals.sourceCount++;
      }
    }

    // Email threads (for jobs and projects)
    if (entityType === 'job' && entity.project_id) {
      const project = await base44.asServiceRole.entities.Project.get(entity.project_id);
      if (project.source_email_thread_id) {
        const thread = await base44.asServiceRole.entities.EmailThread.get(project.source_email_thread_id);
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        });
        
        signals.emails = messages.map(m => ({
          subject: m.subject,
          body_text: m.body_text?.substring(0, 1000), // Limit to avoid token overflow
          sent_at: m.sent_at,
          from_address: m.from_address
        }));
        
        if (messages.length > 0) signals.sourceCount++;
      }
    }

    if (entityType === 'project' && entity.source_email_thread_id) {
      const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
        thread_id: entity.source_email_thread_id 
      });
      
      signals.emails = messages.map(m => ({
        subject: m.subject,
        body_text: m.body_text?.substring(0, 1000),
        sent_at: m.sent_at,
        from_address: m.from_address
      }));
      
      if (messages.length > 0) signals.sourceCount++;
    }

  } catch (error) {
    console.error('Error gathering signals:', error);
  }

  return signals;
}

function buildAnalysisPrompt(entityType, entity, signals) {
  return `You are an AI analyzing a ${entityType} to suggest attention flags based on STRICT RULES.

${TIER_1_RULES}

ENTITY DATA:
${JSON.stringify({
  type: entityType,
  id: entity.id,
  name: entityType === 'customer' ? entity.name : entityType === 'project' ? entity.title : `Job #${entity.job_number}`,
  status: entity.status,
  address: entity.address || entity.address_full
}, null, 2)}

COLLECTED SIGNALS (${signals.sourceCount} sources):

Notes & Descriptions:
${signals.notes.map(n => `[${n.source}]: ${n.content}`).join('\n\n')}

Job Summaries:
${signals.jobSummaries.map((s, i) => `
Summary ${i + 1}:
- Overview: ${s.overview || 'N/A'}
- Issues: ${s.issues_found || 'N/A'}
- Resolution: ${s.resolution || 'N/A'}
- Next Steps: ${s.next_steps || 'N/A'}
- Communication: ${s.communication_with_client || 'N/A'}
`).join('\n')}

Email Messages:
${signals.emails.map((e, i) => `
Email ${i + 1} (${e.sent_at}):
Subject: ${e.subject}
From: ${e.from_address}
Body excerpt: ${e.body_text?.substring(0, 500) || 'N/A'}
`).join('\n')}

Parts & Logistics:
${signals.parts.map(p => `- Status: ${p.status}, Location: ${p.location || 'N/A'}, ETA: ${p.eta || 'N/A'}, Notes: ${p.notes || 'N/A'}`).join('\n')}

Trade Requirements:
${signals.trades.map(t => `- ${t.trade_type}: Required=${t.is_required}, Booked=${t.is_booked}, Notes: ${t.notes || 'N/A'}`).join('\n')}

Payment History:
${signals.payments.length > 0 ? JSON.stringify(signals.payments, null, 2) : 'None'}

Photos:
${signals.photos.map(p => `- Tags: ${p.tags?.join(', ') || 'None'}, Notes: ${p.notes || 'N/A'}`).join('\n')}

---

TASK:
Analyze ONLY the data above. Apply TIER 1 rules STRICTLY.

For each potential flag:
1. Count corroborating signals (need 2+)
2. Identify which sources support it
3. Calculate confidence (0-1)
4. Determine if it has operational impact

Output ONLY flags that meet ALL criteria:
- 2+ corroborating signals
- Confidence ≥ 0.65
- Operational impact (changes scheduling/prep/communication/risk)
- Matches a TIER 1 category

For each suggested flag, provide:
- type: one of (site_constraint, logistics_dependency, payment_hold, technical_risk, access_issue)
- label: brief title
- details: specific evidence from sources
- severity: info/warning/critical
- confidence: 0.65-1.0
- source_refs: { email_thread_id, job_id, note_excerpt }
- reasoning: why you're suggesting this (for debugging)

If no flags meet the criteria, return empty array.

CRITICAL: Be conservative. When in doubt, DON'T suggest.`;
}