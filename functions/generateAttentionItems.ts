import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHash } from 'node:crypto';

// Hard trigger dictionary for pre-filtering
const HARD_TRIGGERS = {
  'Access & Site': {
    keywords: ['key', 'keys', 'lockbox', 'code', 'gate code', 'access', 'intercom', 'parking', 
               'height restriction', 'steep driveway', 'no access', 'call on arrival']
  },
  'Payments': {
    keywords: ['overdue', 'unpaid', 'payment reminder', 'final notice', 'stop work', 'not paying', 
               'chargeback', 'dispute invoice', 'balance outstanding', 'past due']
  },
  'Customer Risk': {
    keywords: ['unhappy', 'frustrated', 'disappointed', 'angry', 'complaint', 'escalate', 'refund', 
               'cancel', 'unacceptable', 'fed up', 'terrible', 'poor communication', 'constant delays', 'delay'],
    strong_negatives: ['unhappy', 'frustrated', 'disappointed', 'angry', 'complaint', 'unacceptable', 
                      'refund', 'cancel', 'escalate', 'chargeback', 'dispute'],
    exclude_positive: ['soon', 'one step away', 'excited', 'ready', 'thanks', 'thank']
  }
};

const ALLOWED_EVIDENCE_TYPES = ['email', 'project_message', 'job_message', 'note', 'call_log', 'sms'];

// Check if text contains hard triggers for a category
function checkTriggers(text, category) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const triggers = HARD_TRIGGERS[category];
  if (!triggers) return false;
  
  // Check for positive words that should exclude Customer Risk
  if (category === 'Customer Risk' && triggers.exclude_positive) {
    for (const positive of triggers.exclude_positive) {
      if (lowerText.includes(positive)) {
        // Check if there's also a strong negative - if not, reject
        const hasStrongNegative = triggers.strong_negatives.some(neg => lowerText.includes(neg));
        if (!hasStrongNegative) return false;
      }
    }
  }
  
  // Check if any keyword matches
  const hasKeyword = triggers.keywords.some(kw => lowerText.includes(kw));
  if (!hasKeyword) return false;
  
  // For Customer Risk, require strong negative word
  if (category === 'Customer Risk' && triggers.strong_negatives) {
    return triggers.strong_negatives.some(word => lowerText.includes(word));
  }
  
  return true;
}

// Pre-filter: check if ANY evidence has triggers
function hasAnyTriggers(evidenceRecords) {
  for (const record of evidenceRecords) {
    const text = record.content || record.body_text || record.message || '';
    for (const category of Object.keys(HARD_TRIGGERS)) {
      if (checkTriggers(text, category)) {
        return true;
      }
    }
  }
  return false;
}

// Normalize category
function normalizeCategory(category) {
  if (!category) return null;
  const normalized = category.trim().toLowerCase();
  
  if (['customer risk', 'customer concern', 'customer sentiment'].includes(normalized)) return 'Customer Risk';
  if (['access', 'access & site', 'site access'].includes(normalized)) return 'Access & Site';
  if (['payments', 'payment', 'payment risk'].includes(normalized)) return 'Payments';
  
  return null;
}

// Canonical intent normalization
function getCanonicalIntent(title, summaryBullets, category) {
  const text = (title + ' ' + (summaryBullets || []).join(' ')).toLowerCase();
  
  if (category === 'Access & Site') {
    return 'access_code_or_keys';
  } else if (category === 'Payments') {
    return 'payment_stop_work';
  } else if (category === 'Customer Risk') {
    return 'explicit_customer_dissatisfaction';
  }
  
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
      no_trigger: 0,
      bad_evidence: 0,
      weak_sentiment: 0,
      invalid_category: 0,
      upstream_exists: 0,
      duplicate: 0
    };

    // STEP 1: Load ONLY real comms evidence
    let evidenceRecords = [];
    let job = null;
    let project = null;
    let customer = null;
    
    if (entity_type === 'job') {
      job = await base44.entities.Job.get(entity_id);
      if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
      
      // Load JobMessages
      try {
        const messages = await base44.entities.JobMessage.filter({ job_id: entity_id }, '-created_at');
        evidenceRecords.push(...messages.slice(0, 15).map(m => ({
          id: m.id,
          type: 'job_message',
          content: m.message,
          sender: m.sender_name,
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
          subject: e.subject,
          from: e.from_address,
          created_at: e.created_at
        })));
      } catch (e) {}
      
    } else if (entity_type === 'project') {
      project = await base44.entities.Project.get(entity_id);
      if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
      
      // Load ProjectMessages
      try {
        const messages = await base44.entities.ProjectMessage.filter({ project_id: entity_id }, '-created_at');
        evidenceRecords.push(...messages.slice(0, 15).map(m => ({
          id: m.id,
          type: 'project_message',
          content: m.message,
          sender: m.sender_name,
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
          subject: e.subject,
          from: e.from_address,
          created_at: e.created_at
        })));
      } catch (e) {}
      
    } else if (entity_type === 'customer') {
      customer = await base44.entities.Customer.get(entity_id);
      if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });
      
      // For customers, load recent project/job messages
      try {
        const projects = await base44.entities.Project.filter({ customer_id: entity_id });
        for (const proj of projects.slice(0, 3)) {
          const messages = await base44.entities.ProjectMessage.filter({ project_id: proj.id }, '-created_at');
          evidenceRecords.push(...messages.slice(0, 5).map(m => ({
            id: m.id,
            type: 'project_message',
            content: m.message,
            sender: m.sender_name,
            created_at: m.created_at
          })));
        }
      } catch (e) {}
    }

    // STEP 2: PRE-FILTER - Check for hard triggers
    if (!hasAnyTriggers(evidenceRecords)) {
      rejectionCounts.no_trigger = 1;
      return Response.json({
        success: true,
        created_count: 0,
        skipped_count: 0,
        items: [],
        rejected_reasons: rejectionCounts,
        message: 'No hard triggers found in evidence'
      });
    }

    // STEP 3: Call LLM with strict evidence requirements
    const contextForAI = {
      entity_type,
      entity_id,
      evidence_records: evidenceRecords.map(e => ({
        id: e.id,
        type: e.type,
        content: e.content?.substring(0, 500),
        sender: e.sender,
        created_at: e.created_at
      }))
    };

    const aiPrompt = `You are generating Attention Items for KangarooGD garage door company.

CRITICAL RULES:
1. Generate 0-2 items maximum (only if CRITICAL)
2. Each item MUST cite a real evidence record from the provided evidence_records
3. evidence_type must be one of: ["email", "project_message", "job_message", "note", "call_log", "sms"]
4. evidence_entity_id must be the id of an evidence record
5. evidence_excerpt must be a verbatim quote (exact substring) from that record
6. Only create items for:
   - Access restrictions with specific codes/keys mentioned
   - Payment issues explicitly blocking work
   - Customer expressing STRONG dissatisfaction (unhappy, angry, frustrated, complaint)

DO NOT CREATE ITEMS FOR:
- Generic notes or status updates
- Normal operational information
- Positive/neutral customer sentiment
- Inferred problems without explicit evidence

Evidence records:
${JSON.stringify(contextForAI.evidence_records, null, 2)}

Output JSON ONLY:
{
  "items": [
    {
      "category": "Customer Risk",
      "audience": "both",
      "severity": "high",
      "title": "Short factual title",
      "summary_bullets": ["Bullet 1", "Bullet 2"],
      "evidence_type": "project_message",
      "evidence_entity_id": "actual_message_id",
      "evidence_excerpt": "Exact verbatim quote from the message"
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
      const originalCategory = item.category;
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

      // Validate evidence_entity_id exists
      const evidenceRecord = evidenceRecords.find(e => e.id === item.evidence_entity_id);
      if (!evidenceRecord) {
        rejectionCounts.bad_evidence++;
        continue;
      }

      // Validate evidence_excerpt is substring of evidence content
      if (!item.evidence_excerpt || !evidenceRecord.content.includes(item.evidence_excerpt.trim())) {
        rejectionCounts.bad_evidence++;
        continue;
      }

      // For Customer Risk: require strong negative word in excerpt
      if (item.category === 'Customer Risk') {
        const hasStrongNegative = HARD_TRIGGERS['Customer Risk'].strong_negatives.some(
          word => item.evidence_excerpt.toLowerCase().includes(word)
        );
        if (!hasStrongNegative) {
          rejectionCounts.weak_sentiment++;
          continue;
        }
      }

      // Validate that excerpt contains trigger keywords for category
      if (!checkTriggers(item.evidence_excerpt, item.category)) {
        rejectionCounts.bad_evidence++;
        continue;
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

      // Max 2 items
      if (processedItems.length >= 2) break;
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
      rejected_reasons: rejectionCounts
    });

  } catch (error) {
    console.error('Error generating attention items:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});