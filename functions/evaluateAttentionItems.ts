import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// TRIGGER LIBRARY
const TRIGGERS = {
  critical: [
    { patterns: ['unsafe', 'danger', 'hazard', 'injury', 'electrical not certified', 'do not operate', 'power off', 'lock out'], audience: 'both', category: 'safety', trigger_id: 'safety_risk' },
    { patterns: ['no access', 'keys required', 'security', 'gate code', 'restricted access', 'strata approval required'], audience: 'both', category: 'access', trigger_id: 'access_restriction' },
    { patterns: ['non-compliant', 'council', 'insurance', 'warranty void', 'asbestos', 'engineer'], audience: 'office', category: 'compliance', trigger_id: 'compliance_issue' },
    { patterns: ['angry', 'complaint', 'refund', 'legal action', 'ncat', 'dispute'], audience: 'office', category: 'escalation', trigger_id: 'customer_escalation' },
  ],
  important: [
    { patterns: ['only available', 'after 3pm', 'before 9am', 'school pickup', 'tenant', 'builder must attend'], audience: 'office', category: 'scheduling', trigger_id: 'schedule_constraint' },
    { patterns: ['low headroom', 'needs noggins', 'structure missing', 'brick return', 'out of level', 'cannot mount'], audience: 'both', category: 'technical', trigger_id: 'technical_constraint' },
    { patterns: ['deposit', 'balance', 'overdue', 'do not proceed until paid'], audience: 'office', category: 'payment', trigger_id: 'payment_hold' },
    { patterns: ['fragile', 'protect floor', 'pets', 'alarm', 'noise sensitive'], audience: 'tech', category: 'handling', trigger_id: 'special_handling' },
  ],
  info: [
    { patterns: ['call before arrival', 'leave remotes', 'preferred contact method'], audience: 'both', category: 'preference', trigger_id: 'customer_preference' },
  ]
};

// RESOLUTION PATTERNS - indicate issue is resolved
const RESOLUTION_PATTERNS = [
  'completed', 'resolved', 'fixed', 'done', 'paid', 'received payment',
  'electrician completed', 'approved', 'access granted', 'keys received'
];

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\d+/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function createFingerprint(trigger_id, audience, severity) {
  return `${trigger_id}-${audience}-${severity}`;
}

function matchTriggers(text, triggers) {
  const matches = [];
  const lowerText = text.toLowerCase();
  
  for (const [severity, triggerGroups] of Object.entries(triggers)) {
    for (const triggerGroup of triggerGroups) {
      for (const pattern of triggerGroup.patterns) {
        if (lowerText.includes(pattern)) {
          matches.push({
            severity,
            pattern,
            audience: triggerGroup.audience,
            category: triggerGroup.category,
            trigger_id: triggerGroup.trigger_id,
            baseScore: severity === 'critical' ? 70 : severity === 'important' ? 45 : 25
          });
        }
      }
    }
  }
  
  return matches;
}

function checkResolutionPatterns(text) {
  const lowerText = (text || '').toLowerCase();
  return RESOLUTION_PATTERNS.some(pattern => lowerText.includes(pattern));
}

function extractTextCandidates(fields) {
  const candidates = [];
  
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value || typeof value !== 'string') continue;
    
    const matches = matchTriggers(value, TRIGGERS);
    
    for (const match of matches) {
      const lowerValue = value.toLowerCase();
      const patternIndex = lowerValue.indexOf(match.pattern);
      const startIndex = Math.max(0, patternIndex - 50);
      const endIndex = Math.min(value.length, patternIndex + match.pattern.length + 100);
      const context = value.substring(startIndex, endIndex).trim();
      
      const words = context.split(' ').slice(0, 10).join(' ');
      const title = words.length > 60 ? words.substring(0, 60) + '...' : words;
      
      candidates.push({
        title,
        body: context.length > 150 ? context.substring(0, 150) + '...' : context,
        severity: match.severity,
        audience: match.audience,
        trigger_id: match.trigger_id,
        source: 'ai',
        ai_reason: `Matched pattern "${match.pattern}" in field "${fieldName}"`,
        score: match.baseScore,
        source_refs: [fieldName],
        category: match.category
      });
    }
  }
  
  return candidates;
}

function applyStructuredHeuristics(entityType, entityData, relatedData) {
  const candidates = [];
  
  if (entityType === 'job') {
    if (entityData.status === 'Scheduled' && !entityData.address && !entityData.address_full) {
      candidates.push({
        title: 'Missing job address',
        body: 'Address required before technician dispatch',
        severity: 'important',
        audience: 'office',
        trigger_id: 'missing_address',
        source: 'ai',
        ai_reason: 'Job scheduled without address',
        score: 60,
        source_refs: ['status', 'address']
      });
    }
    
    if (entityData.status === 'Completed' && (!entityData.overview || !entityData.outcome)) {
      candidates.push({
        title: 'Incomplete visit documentation',
        body: 'Overview or outcome missing from completed job',
        severity: 'important',
        audience: 'tech',
        trigger_id: 'incomplete_docs',
        source: 'ai',
        ai_reason: 'Completed job missing overview or outcome',
        score: 55,
        source_refs: ['overview', 'outcome']
      });
    }
  }
  
  if (entityType === 'project') {
    if ((entityData.status === 'Scheduled' || entityData.status === 'Completed') &&
        entityData.project_type?.includes('Install') &&
        (!entityData.doors || entityData.doors.length === 0)) {
      candidates.push({
        title: 'Missing door measurements',
        body: 'Installation project requires door specifications',
        severity: 'important',
        audience: 'both',
        trigger_id: 'missing_measurements',
        source: 'ai',
        ai_reason: 'Install project without door measurements',
        score: 55,
        source_refs: ['doors']
      });
    }
    
    if (relatedData.parts) {
      const draftPOs = relatedData.parts.filter(p => 
        p.purchase_order_id && 
        (!p.po_status || p.po_status === 'Draft') &&
        (p.status === 'on_order' || p.status === 'in_transit')
      );
      
      if (draftPOs.length > 0) {
        candidates.push({
          title: 'Parts status mismatch with PO',
          body: `${draftPOs.length} part(s) show as ordered but PO is still draft`,
          severity: 'critical',
          audience: 'office',
          trigger_id: 'po_status_mismatch',
          source: 'ai',
          ai_reason: 'Parts marked on_order but linked PO is Draft status',
          score: 75,
          source_refs: ['parts', 'purchase_orders']
        });
      }
    }
  }
  
  return candidates;
}

function applyScoreModifiers(candidate, entityData) {
  let score = candidate.score || 0;
  
  if (candidate.source_refs && candidate.source_refs.length > 1) {
    score += 15;
  }
  
  const entityDate = new Date(entityData.updated_date || entityData.created_date);
  const daysSince = (Date.now() - entityDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSince <= 7) score += 10;
  else if (daysSince <= 30) score += 5;
  
  const text = (candidate.title + ' ' + (candidate.body || '')).toLowerCase();
  if (text.includes('do not') || text.includes('must') || text.includes('urgent')) {
    score += 10;
  }
  
  if (text.includes('only') || text.includes('required') || text.includes('before') || text.includes('after')) {
    score += 10;
  }
  
  return Math.min(100, score);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { entityType, entityId, eventType } = await req.json();
    
    if (!entityType || !entityId) {
      return Response.json({ error: 'Missing entityType or entityId' }, { status: 400 });
    }
    
    let entityData = null;
    let relatedData = {};
    
    // Fetch entity data
    if (entityType === 'project') {
      entityData = await base44.asServiceRole.entities.Project.get(entityId);
      relatedData.jobs = await base44.asServiceRole.entities.Job.filter({ project_id: entityId });
      relatedData.parts = await base44.asServiceRole.entities.Part.filter({ project_id: entityId });
    } else if (entityType === 'job') {
      entityData = await base44.asServiceRole.entities.Job.get(entityId);
      if (entityData.project_id) {
        relatedData.project = await base44.asServiceRole.entities.Project.get(entityData.project_id);
      }
    } else if (entityType === 'customer') {
      entityData = await base44.asServiceRole.entities.Customer.get(entityId);
    } else {
      return Response.json({ error: 'Invalid entityType' }, { status: 400 });
    }
    
    // Fetch existing attention items
    const existingItems = await base44.asServiceRole.entities.AttentionItem.filter({
      entity_type: entityType,
      entity_id: entityId
    });
    
    const activeByFingerprint = new Map();
    existingItems.filter(item => item.status === 'active').forEach(item => {
      const fp = createFingerprint(item.trigger_id || 'manual', item.audience, item.severity);
      activeByFingerprint.set(fp, item);
    });
    
    // Check hierarchy: if project has item, don't duplicate on job
    let projectItems = [];
    if (entityType === 'job' && entityData.project_id) {
      projectItems = await base44.asServiceRole.entities.AttentionItem.filter({
        entity_type: 'project',
        entity_id: entityData.project_id,
        status: 'active'
      });
    }
    
    const projectFingerprints = new Set(
      projectItems.map(item => createFingerprint(item.trigger_id || 'manual', item.audience, item.severity))
    );
    
    // Collect text fields
    const textFields = {};
    if (entityType === 'project') {
      if (entityData.description) textFields.description = entityData.description;
      if (entityData.notes) textFields.notes = entityData.notes;
    } else if (entityType === 'job') {
      if (entityData.overview) textFields.overview = entityData.overview;
      if (entityData.next_steps) textFields.next_steps = entityData.next_steps;
      if (entityData.communication_with_client) textFields.communication_with_client = entityData.communication_with_client;
      if (entityData.completion_notes) textFields.completion_notes = entityData.completion_notes;
      if (entityData.notes) textFields.notes = entityData.notes;
    } else if (entityType === 'customer') {
      if (entityData.notes) textFields.notes = entityData.notes;
    }
    
    // Check for resolution patterns in recent updates
    const hasResolutionPattern = Object.values(textFields).some(checkResolutionPatterns);
    
    // Extract candidates
    let candidates = extractTextCandidates(textFields);
    const structuredCandidates = applyStructuredHeuristics(entityType, entityData, relatedData);
    candidates = [...candidates, ...structuredCandidates];
    
    // Apply scoring
    candidates = candidates.map(c => ({
      ...c,
      score: applyScoreModifiers(c, entityData)
    })).filter(c => c.score >= 30);
    
    // Deduplicate
    const seen = new Set();
    const deduplicated = [];
    
    for (const candidate of candidates) {
      const fingerprint = createFingerprint(candidate.trigger_id, candidate.audience, candidate.severity);
      
      // Skip if project already has this
      if (projectFingerprints.has(fingerprint)) continue;
      
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      
      const existing = activeByFingerprint.get(fingerprint);
      
      if (existing) {
        // Update score if needed
        if (candidate.score !== existing.score) {
          await base44.asServiceRole.entities.AttentionItem.update(existing.id, {
            score: candidate.score
          });
        }
      } else {
        deduplicated.push(candidate);
      }
    }
    
    // Apply caps and create new items
    const maxItems = entityType === 'project' ? 5 : 3;
    const sorted = deduplicated.sort((a, b) => b.score - a.score).slice(0, maxItems);
    
    const created = [];
    for (const candidate of sorted) {
      const item = await base44.asServiceRole.entities.AttentionItem.create({
        entity_type: entityType,
        entity_id: entityId,
        trigger_id: candidate.trigger_id,
        title: candidate.title,
        body: candidate.body,
        severity: candidate.score >= 70 ? 'critical' : candidate.score >= 50 ? 'important' : 'info',
        audience: candidate.audience,
        source: 'ai',
        ai_reason: candidate.ai_reason,
        status: 'active'
      });
      created.push(item);
    }
    
    // Resolution logic: mark items as resolved if resolution patterns detected
    if (hasResolutionPattern) {
      const activeItems = Array.from(activeByFingerprint.values());
      for (const item of activeItems) {
        await base44.asServiceRole.entities.AttentionItem.update(item.id, {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: 'system'
        });
      }
    }
    
    return Response.json({ 
      success: true,
      created_count: created.length,
      resolved_count: hasResolutionPattern ? activeByFingerprint.size : 0,
      event_type: eventType
    });
    
  } catch (error) {
    console.error('Error evaluating attention items:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});