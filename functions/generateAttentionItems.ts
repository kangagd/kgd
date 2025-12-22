import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHash } from 'node:crypto';

// Scoring keywords per category
const SCORING_KEYWORDS = {
  'Payments': {
    strong: ['payment demand', 'final notice', 'unpaid', 'payment outstanding', 'chargeback', 'dispute invoice'],
    medium: ['payment reminder', 'follow up payment', 'past due', 'balance owing', 'overdue'],
    threshold: 2
  },
  'Access & Site': {
    strong: ['lockbox', 'key code', 'gate code', 'no access', 'call on arrival', 'keys need collecting', 'access code'],
    medium: ['intercom', 'parking', 'height restriction', 'after hours'],
    threshold: 2
  },
  'Hard Blocker': {
    strong: ['parts missing', 'incorrect parts', 'defective'],
    medium: ['waiting on parts'],
    threshold: 2
  },
  'Safety': {
    strong: ['unsafe', 'hazard', 'asbestos', 'live wires', 'fall risk', 'aggressive dog'],
    medium: ['ladder required', 'tight access', 'security concern'],
    threshold: 2
  },
  'Customer Risk': {
    strong: ['unhappy', 'frustrated', 'disappointed', 'angry', 'complaint', 'unacceptable', 'refund', 'cancel', 'escalate', 'chargeback', 'dispute', 'ongoing delays'],
    medium: ['delays'],
    threshold: 3,
    strong_required: true
  }
};

const CUSTOMER_RISK_STRONG_NEGATIVES = ['unhappy', 'frustrated', 'disappointed', 'angry', 'complaint', 'unacceptable', 'refund', 'cancel', 'escalate', 'chargeback', 'dispute', 'ongoing delays'];

const ALLOWED_EVIDENCE_TYPES = ['email', 'project_message', 'job_message', 'note', 'call_log', 'sms', 'field'];

const ALLOWED_FIELD_EVIDENCE = {
  'Job': ['overview', 'outcome', 'next_steps', 'communication_with_client', 'additional_info', 'notes'],
  'Project': ['description', 'notes'],
  'Customer': ['notes']
};

// Helper: Detect negative client sentiment in emails
function detectNegativeClientSentiment(emails) {
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return null;
  }

  // Conservative keywords/phrases for frustration or dissatisfaction
  const negativeKeywords = [
    'disappointed',
    'frustrated',
    'unhappy',
    'unacceptable',
    'dissatisfied',
    'complaint',
    'unprofessional',
    'poor service',
    'not happy',
    'very upset',
    'terrible',
    'horrible',
    'awful',
    'disgusted',
    'angry',
    'furious',
    'fed up',
    'sick of',
    'had enough',
    'this is ridiculous',
    'this is unacceptable',
    'extremely poor',
    'very disappointed',
    'very frustrated'
  ];

  // Filter inbound client emails only (is_outbound: false or missing)
  const inboundEmails = emails
    .filter(email => !email.is_outbound)
    .sort((a, b) => new Date(b.sent_at || b.created_at || 0) - new Date(a.sent_at || a.created_at || 0));

  // Scan for negative sentiment
  for (const email of inboundEmails) {
    const content = ((email.body_text || email.content || '').toLowerCase());
    
    for (const keyword of negativeKeywords) {
      if (content.includes(keyword)) {
        // Extract snippet around the keyword
        const index = content.indexOf(keyword);
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + keyword.length + 40);
        const snippet = content.substring(start, end).trim();
        
        return {
          timestamp: email.sent_at || email.created_at,
          snippet: snippet.substring(0, 150),
          matched_keyword: keyword,
          email_id: email.id
        };
      }
    }
  }

  return null;
}

// Score evidence records for each category
function scoreEvidence(evidenceRecords) {
  const scores = {};
  const contributingEvidence = {};
  
  for (const category of Object.keys(SCORING_KEYWORDS)) {
    scores[category] = 0;
    contributingEvidence[category] = [];
    
    const config = SCORING_KEYWORDS[category];
    
    for (const record of evidenceRecords) {
      const text = (record.content || '').toLowerCase();
      let recordScore = 0;
      
      // Check strong keywords (+2 or +3)
      for (const keyword of config.strong) {
        if (text.includes(keyword)) {
          recordScore += (category === 'Customer Risk' ? 3 : 2);
        }
      }
      
      // Check medium keywords (+1)
      for (const keyword of config.medium) {
        if (text.includes(keyword)) {
          // Special rule: "delays" only counts if strong negative present
          if (category === 'Customer Risk' && keyword === 'delays') {
            const hasStrongNegative = CUSTOMER_RISK_STRONG_NEGATIVES.some(neg => text.includes(neg));
            if (hasStrongNegative) recordScore += 1;
          } else {
            recordScore += 1;
          }
        }
      }
      
      if (recordScore > 0) {
        scores[category] += recordScore;
        contributingEvidence[category].push({ record, score: recordScore });
      }
    }
  }
  
  return { scores, contributingEvidence };
}

// Normalize category
function normalizeCategory(category) {
  if (!category) return null;
  const normalized = category.trim().toLowerCase();
  
  if (['customer risk', 'customer concern', 'customer sentiment'].includes(normalized)) return 'Customer Risk';
  if (['access', 'access & site', 'site access'].includes(normalized)) return 'Access & Site';
  if (['payments', 'payment', 'payment risk'].includes(normalized)) return 'Payments';
  if (['safety', 'safety risk', 'safety hazard'].includes(normalized)) return 'Safety';
  if (['hard blocker', 'blocker', 'critical blocker'].includes(normalized)) return 'Hard Blocker';
  
  return null;
}

// Canonical intent normalization
function getCanonicalIntent(title, summaryBullets, category) {
  if (category === 'Access & Site') return 'access_code_keys_or_entry';
  if (category === 'Payments') return 'payment_block_or_overdue';
  if (category === 'Customer Risk') return 'explicit_customer_dissatisfaction';
  if (category === 'Safety') return 'site_safety_hazard';
  if (category === 'Hard Blocker') return 'job_blocker_parts_structure_power_fit';
  
  return 'generic';
}

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

    if (!['job', 'project', 'customer'].includes(entity_type)) {
      return Response.json({ error: 'entity_type must be job, project, or customer' }, { status: 400 });
    }

    const rejectionCounts = {
      bad_evidence: 0,
      weak_sentiment: 0,
      invalid_category: 0,
      upstream_exists: 0,
      duplicate: 0,
      not_verbatim: 0
    };

    // STEP 1: Load evidence (messages + allowed fields)
    let evidenceRecords = [];
    let job = null;
    let project = null;
    let customer = null;
    let entityContext = {};
    
    if (entity_type === 'job') {
      job = await base44.entities.Job.get(entity_id);
      if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
      
      entityContext = {
        job_number: job.job_number,
        job_type: job.job_type_name || job.job_type
      };
      
      // Load JobMessages
      try {
        const messages = await base44.entities.JobMessage.filter({ job_id: entity_id }, '-created_at');
        evidenceRecords.push(...messages.slice(0, 15).map(m => ({
          id: m.id,
          type: 'job_message',
          content: m.message,
          created_at: m.created_at
        })));
      } catch (e) {}
      
      // Load emails linked to job
      try {
        const emails = await base44.entities.ProjectEmail.filter({ job_id: entity_id }, '-created_at');
        evidenceRecords.push(...emails.slice(0, 10).map(e => ({
          id: e.id,
          type: 'email',
          content: e.body_text || '',
          created_at: e.created_at
        })));
      } catch (e) {}
      
      // Add field evidence
      for (const field of ALLOWED_FIELD_EVIDENCE['Job']) {
        if (job[field] && job[field].trim()) {
          evidenceRecords.push({
            id: `Job:${entity_id}:${field}`,
            type: 'field',
            content: job[field],
            field_name: field,
            entity_type: 'Job'
          });
        }
      }
      
    } else if (entity_type === 'project') {
      project = await base44.entities.Project.get(entity_id);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      
      entityContext = {
        project_number: project.project_number,
        project_title: project.title
      };
      
      // Load ProjectMessages
      try {
        const messages = await base44.entities.ProjectMessage.filter({ project_id: entity_id }, '-created_at');
        evidenceRecords.push(...messages.slice(0, 15).map(m => ({
          id: m.id,
          type: 'project_message',
          content: m.message,
          created_at: m.created_at
        })));
      } catch (e) {}
      
      // Load emails linked to project
      try {
        const emails = await base44.entities.ProjectEmail.filter({ project_id: entity_id }, '-created_at');
        evidenceRecords.push(...emails.slice(0, 10).map(e => ({
          id: e.id,
          type: 'email',
          content: e.body_text || '',
          created_at: e.created_at
        })));
      } catch (e) {}
      
      // Add field evidence
      for (const field of ALLOWED_FIELD_EVIDENCE['Project']) {
        if (project[field] && project[field].trim()) {
          evidenceRecords.push({
            id: `Project:${entity_id}:${field}`,
            type: 'field',
            content: project[field],
            field_name: field,
            entity_type: 'Project'
          });
        }
      }
      
    } else if (entity_type === 'customer') {
      customer = await base44.entities.Customer.get(entity_id);
      if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });
      
      entityContext = {
        customer_name: customer.name
      };
      
      // For customers, load recent project/job messages
      try {
        const projects = await base44.entities.Project.filter({ customer_id: entity_id });
        for (const proj of projects.slice(0, 3)) {
          const messages = await base44.entities.ProjectMessage.filter({ project_id: proj.id }, '-created_at');
          evidenceRecords.push(...messages.slice(0, 5).map(m => ({
            id: m.id,
            type: 'project_message',
            content: m.message,
            created_at: m.created_at
          })));
        }
      } catch (e) {}
      
      // Add field evidence
      for (const field of ALLOWED_FIELD_EVIDENCE['Customer']) {
        if (customer[field] && customer[field].trim()) {
          evidenceRecords.push({
            id: `Customer:${entity_id}:${field}`,
            type: 'field',
            content: customer[field],
            field_name: field,
            entity_type: 'Customer'
          });
        }
      }
    }

    // STEP 2: Score evidence by category
    const { scores, contributingEvidence } = scoreEvidence(evidenceRecords);
    
    // Check which categories meet threshold
    const thresholdsMet = [];
    for (const [category, score] of Object.entries(scores)) {
      const config = SCORING_KEYWORDS[category];
      if (score >= config.threshold) {
        thresholdsMet.push(category);
      }
    }
    
    // If no thresholds met, return early
    if (thresholdsMet.length === 0) {
      return Response.json({
        success: true,
        created_count: 0,
        skipped_count: 0,
        items: [],
        rejected_reasons: rejectionCounts,
        scored_categories: scores,
        thresholds_met: [],
        message: 'No categories reached scoring threshold'
      });
    }
    
    // Build top evidence for LLM (max 8 snippets)
    const topEvidence = [];
    for (const category of thresholdsMet) {
      const sorted = contributingEvidence[category].sort((a, b) => b.score - a.score);
      topEvidence.push(...sorted.slice(0, 3).map(e => e.record));
    }
    const uniqueEvidence = Array.from(new Map(topEvidence.map(e => [e.id, e])).values()).slice(0, 8);

    // STEP 3: Call LLM with top evidence
    const contextForAI = {
      entity_context: entityContext,
      categories_above_threshold: thresholdsMet,
      evidence_records: uniqueEvidence.map(e => ({
        id: e.id,
        type: e.type,
        content: e.content?.substring(0, 500),
        field_name: e.field_name,
        entity_type: e.entity_type
      }))
    };

    const aiPrompt = `You are generating Attention Items for KangarooGD garage door company.

Entity context: ${JSON.stringify(entityContext)}
Categories that scored above threshold: ${thresholdsMet.join(', ')}

RULES:
1. Generate 0-2 items (max 3 if at least one is severity="high")
2. Each item MUST cite a real evidence record from evidence_records below
3. evidence_type can be: "email", "project_message", "job_message", "field"
4. evidence_entity_id must match an evidence record id
5. evidence_excerpt MUST be verbatim text from that record (no paraphrasing)
6. Titles must be plain and specific, no drama, no "potential" unless justified
7. Only create items for: Payments, Access & Site, Hard Blocker, Safety, Customer Risk

Evidence records:
${JSON.stringify(contextForAI.evidence_records, null, 2)}

Output JSON ONLY:
{
  "items": [
    {
      "category": "Payments",
      "audience": "both",
      "severity": "high",
      "title": "Plain factual title",
      "summary_bullets": ["Bullet 1", "Bullet 2"],
      "evidence_type": "field",
      "evidence_entity_id": "Job:abc:notes",
      "evidence_excerpt": "Exact verbatim substring from evidence"
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
    const processedItems = [];

    // STEP 4: POST-VALIDATION (strict)
    for (const item of items) {
      // Validate category
      item.category = normalizeCategory(item.category);
      if (!item.category) {
        rejectionCounts.invalid_category++;
        continue;
      }

      // Validate evidence_type
      if (!item.evidence_type || !ALLOWED_EVIDENCE_TYPES.includes(item.evidence_type)) {
        rejectionCounts.bad_evidence++;
        continue;
      }
      
      // Validate evidence_excerpt not empty
      if (!item.evidence_excerpt || !item.evidence_excerpt.trim()) {
        rejectionCounts.bad_evidence++;
        continue;
      }

      // Validate evidence_entity_id exists
      const evidenceRecord = evidenceRecords.find(e => e.id === item.evidence_entity_id);
      if (!evidenceRecord) {
        rejectionCounts.bad_evidence++;
        continue;
      }

      // Validate evidence_excerpt is verbatim substring
      if (!evidenceRecord.content.includes(item.evidence_excerpt.trim())) {
        rejectionCounts.not_verbatim++;
        continue;
      }

      // For Customer Risk: require strong negative word in excerpt
      if (item.category === 'Customer Risk') {
        const hasStrongNegative = CUSTOMER_RISK_STRONG_NEGATIVES.some(
          word => item.evidence_excerpt.toLowerCase().includes(word)
        );
        if (!hasStrongNegative) {
          rejectionCounts.weak_sentiment++;
          continue;
        }
      }

      // Limit bullets to 2
      if (item.summary_bullets) {
        item.summary_bullets = item.summary_bullets.slice(0, 2);
      }

      // Truncate excerpt to 160 chars
      if (item.evidence_excerpt.length > 160) {
        item.evidence_excerpt = item.evidence_excerpt.substring(0, 157) + '...';
      }

      // Generate canonical dedupe_key
      const canonicalIntent = getCanonicalIntent(item.title, item.summary_bullets, item.category);
      const canonicalKeyString = `${item.category.toLowerCase()}|${canonicalIntent}`;
      const canonical_key = createHash('sha256').update(canonicalKeyString).digest('hex');
      const dedupe_key = `${item.category.toLowerCase().replace(/[^a-z]/g, '_')}:${canonicalIntent}`;

      // Check for upstream duplicates
      let upstreamExists = false;
      if (entity_type === 'project' && project?.customer_id) {
        const upstream = await base44.entities.AttentionItem.filter({
          entity_type: 'customer',
          entity_id: project.customer_id,
          dedupe_key,
          status: 'open'
        });
        upstreamExists = upstream && upstream.length > 0;
      } else if (entity_type === 'job') {
        const checks = [];
        if (job?.project_id) {
          checks.push(base44.entities.AttentionItem.filter({
            entity_type: 'project',
            entity_id: job.project_id,
            dedupe_key,
            status: 'open'
          }));
        }
        if (job?.customer_id) {
          checks.push(base44.entities.AttentionItem.filter({
            entity_type: 'customer',
            entity_id: job.customer_id,
            dedupe_key,
            status: 'open'
          }));
        }
        if (checks.length > 0) {
          const results = await Promise.all(checks);
          upstreamExists = results.some(r => r && r.length > 0);
        }
      }

      if (upstreamExists) {
        rejectionCounts.upstream_exists++;
        continue;
      }

      // Check for exact duplicates at this level
      const fingerprintString = `${entity_type}|${entity_id}|${dedupe_key}`;
      const fingerprint = createHash('sha256').update(fingerprintString).digest('hex');
      
      const existing = await base44.entities.AttentionItem.filter({
        entity_type,
        entity_id,
        fingerprint,
        status: 'open'
      });

      if (existing && existing.length > 0) {
        rejectionCounts.duplicate++;
        continue;
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
        fingerprint,
        dedupe_key,
        canonical_key
      });

      // Max 3 items (only if at least one is high severity)
      if (processedItems.length >= 2) {
        const hasHighSeverity = processedItems.some(i => i.severity === 'high');
        if (!hasHighSeverity || processedItems.length >= 3) break;
      }
    }

    // STEP 5: Persist
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
      rejected_reasons: rejectionCounts,
      scored_categories: scores,
      thresholds_met: thresholdsMet
    });

  } catch (error) {
    console.error('Error generating attention items:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});