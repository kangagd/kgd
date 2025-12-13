import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// TRIGGER LIBRARY - Deterministic keyword patterns
const TRIGGERS = {
  critical: [
    { patterns: ['unsafe', 'danger', 'hazard', 'injury', 'electrical not certified', 'do not operate', 'power off', 'lock out'], audience: 'both', category: 'safety' },
    { patterns: ['no access', 'keys required', 'security', 'gate code', 'restricted access', 'strata approval required'], audience: 'both', category: 'access' },
    { patterns: ['non-compliant', 'council', 'insurance', 'warranty void', 'asbestos', 'engineer'], audience: 'office', category: 'compliance' },
    { patterns: ['angry', 'complaint', 'refund', 'legal action', 'ncat', 'dispute'], audience: 'office', category: 'escalation' },
  ],
  important: [
    { patterns: ['only available', 'after 3pm', 'before 9am', 'school pickup', 'tenant', 'builder must attend'], audience: 'office', category: 'scheduling' },
    { patterns: ['low headroom', 'needs noggins', 'structure missing', 'brick return', 'out of level', 'cannot mount'], audience: 'both', category: 'technical' },
    { patterns: ['deposit', 'balance', 'overdue', 'do not proceed until paid'], audience: 'office', category: 'payment' },
    { patterns: ['fragile', 'protect floor', 'pets', 'alarm', 'noise sensitive'], audience: 'tech', category: 'handling' },
  ],
  info: [
    { patterns: ['call before arrival', 'leave remotes', 'preferred contact method'], audience: 'both', category: 'preference' },
  ]
};

// Normalize text for fingerprinting
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\d+/g, '') // remove numbers
    .replace(/[^\w\s]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Create fingerprint for deduplication
function createFingerprint(title, audience, severity) {
  const normalized = normalizeText(title);
  return `${normalized}-${audience}-${severity}`;
}

// Check if text matches any trigger patterns
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
            baseScore: severity === 'critical' ? 70 : severity === 'important' ? 45 : 25
          });
        }
      }
    }
  }
  
  return matches;
}

// Extract candidates from text fields
function extractTextCandidates(fields, entityType) {
  const candidates = [];
  
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value || typeof value !== 'string') continue;
    
    const matches = matchTriggers(value, TRIGGERS);
    
    for (const match of matches) {
      // Extract relevant sentence/context
      const lowerValue = value.toLowerCase();
      const patternIndex = lowerValue.indexOf(match.pattern);
      const startIndex = Math.max(0, patternIndex - 50);
      const endIndex = Math.min(value.length, patternIndex + match.pattern.length + 100);
      const context = value.substring(startIndex, endIndex).trim();
      
      // Create title from context (max 10 words)
      const words = context.split(' ').slice(0, 10).join(' ');
      const title = words.length > 60 ? words.substring(0, 60) + '...' : words;
      
      candidates.push({
        title,
        body: context.length > 150 ? context.substring(0, 150) + '...' : context,
        severity: match.severity,
        audience: match.audience,
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

// Apply structured heuristics
function applyStructuredHeuristics(entityType, entityData, relatedData) {
  const candidates = [];
  
  if (entityType === 'job') {
    // Job scheduled but no address
    if (entityData.status === 'Scheduled' && !entityData.address && !entityData.address_full) {
      candidates.push({
        title: 'Missing job address',
        body: 'Address required before technician dispatch',
        severity: 'important',
        audience: 'office',
        source: 'ai',
        ai_reason: 'Job scheduled without address',
        score: 60,
        source_refs: ['status', 'address']
      });
    }
    
    // Completed job missing required fields
    if (entityData.status === 'Completed' && (!entityData.overview || !entityData.outcome)) {
      candidates.push({
        title: 'Incomplete visit documentation',
        body: 'Overview or outcome missing from completed job',
        severity: 'important',
        audience: 'tech',
        source: 'ai',
        ai_reason: 'Completed job missing overview or outcome',
        score: 55,
        source_refs: ['overview', 'outcome']
      });
    }
    
    // Install job with no photos
    if (entityData.status === 'Completed' && 
        (entityData.job_type_name?.toLowerCase().includes('install') || entityData.product) &&
        (!entityData.image_urls || entityData.image_urls.length === 0)) {
      candidates.push({
        title: 'No photos uploaded for installation',
        body: 'Photos required for installation jobs',
        severity: 'important',
        audience: 'tech',
        source: 'ai',
        ai_reason: 'Completed installation job without photos',
        score: 50,
        source_refs: ['image_urls']
      });
    }
  }
  
  if (entityType === 'project') {
    // Scheduled/Completed install project with incomplete measurements
    if ((entityData.status === 'Scheduled' || entityData.status === 'Completed') &&
        entityData.project_type?.includes('Install') &&
        (!entityData.doors || entityData.doors.length === 0)) {
      candidates.push({
        title: 'Missing door measurements',
        body: 'Installation project requires door specifications',
        severity: 'important',
        audience: 'both',
        source: 'ai',
        ai_reason: 'Install project without door measurements',
        score: 55,
        source_refs: ['doors']
      });
    }
    
    // Completed project without warranty
    if (entityData.status === 'Completed' && 
        entityData.warranty_enabled === true &&
        !entityData.warranty_start_date) {
      candidates.push({
        title: 'Warranty not activated',
        body: 'Project completed but warranty not started',
        severity: 'important',
        audience: 'office',
        source: 'ai',
        ai_reason: 'Completed project missing warranty activation',
        score: 50,
        source_refs: ['warranty_start_date']
      });
    }
    
    // Parts inconsistency detection
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
          source: 'ai',
          ai_reason: 'Parts marked on_order but linked PO is Draft status',
          score: 75,
          source_refs: ['parts', 'purchase_orders']
        });
      }
    }
  }
  
  if (entityType === 'customer') {
    // Customer with complaint history
    const notes = entityData.notes || '';
    if (notes.toLowerCase().includes('complaint') || notes.toLowerCase().includes('issue')) {
      candidates.push({
        title: 'Previous complaint recorded',
        body: 'Check customer notes before scheduling',
        severity: 'important',
        audience: 'office',
        source: 'ai',
        ai_reason: 'Customer notes contain complaint/issue keywords',
        score: 50,
        source_refs: ['notes']
      });
    }
  }
  
  return candidates;
}

// Score modifiers
function applyScoreModifiers(candidate, entityData, relatedData) {
  let score = candidate.score || 0;
  
  // Multiple sources
  if (candidate.source_refs && candidate.source_refs.length > 1) {
    score += 15;
  }
  
  // Recency (check entity dates)
  const entityDate = new Date(entityData.updated_date || entityData.created_date);
  const daysSince = (Date.now() - entityDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSince <= 7) score += 10;
  else if (daysSince <= 30) score += 5;
  
  // Strong action language
  const text = (candidate.title + ' ' + (candidate.body || '')).toLowerCase();
  if (text.includes('do not') || text.includes('must') || text.includes('urgent')) {
    score += 10;
  }
  
  // Explicit constraints
  if (text.includes('only') || text.includes('required') || text.includes('before') || text.includes('after')) {
    score += 10;
  }
  
  return Math.min(100, score);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { entityType, entityId } = await req.json();
    
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
      relatedData.messages = await base44.asServiceRole.entities.ProjectMessage.filter({ project_id: entityId });
      relatedData.tasks = await base44.asServiceRole.entities.Task.filter({ project_id: entityId, status: { $ne: 'Completed' } });
    } else if (entityType === 'job') {
      entityData = await base44.asServiceRole.entities.Job.get(entityId);
      if (entityData.project_id) {
        relatedData.project = await base44.asServiceRole.entities.Project.get(entityData.project_id);
      }
      relatedData.summaries = await base44.asServiceRole.entities.JobSummary.filter({ job_id: entityId });
      relatedData.messages = await base44.asServiceRole.entities.JobMessage.filter({ job_id: entityId });
    } else if (entityType === 'customer') {
      entityData = await base44.asServiceRole.entities.Customer.get(entityId);
      relatedData.projects = await base44.asServiceRole.entities.Project.filter({ customer_id: entityId });
      relatedData.jobs = await base44.asServiceRole.entities.Job.filter({ customer_id: entityId });
    } else {
      return Response.json({ error: 'Invalid entityType' }, { status: 400 });
    }
    
    // Check for existing active and dismissed items to avoid duplicates
    const existingItems = await base44.asServiceRole.entities.AttentionItem.filter({
      entity_type: entityType,
      entity_id: entityId
    });
    
    const activeFingerprints = new Set(
      existingItems
        .filter(item => item.status === 'active')
        .map(item => createFingerprint(item.title, item.audience, item.severity))
    );
    
    const dismissedFingerprints = new Set(
      existingItems
        .filter(item => item.status === 'dismissed')
        .map(item => createFingerprint(item.title, item.audience, item.severity))
    );
    
    // Collect candidates from text fields
    const textFields = {};
    if (entityType === 'project') {
      if (entityData.description) textFields.description = entityData.description;
      if (entityData.notes) textFields.notes = entityData.notes;
      if (entityData.lost_reason_notes) textFields.lost_reason_notes = entityData.lost_reason_notes;
    } else if (entityType === 'job') {
      if (entityData.overview) textFields.overview = entityData.overview;
      if (entityData.next_steps) textFields.next_steps = entityData.next_steps;
      if (entityData.communication_with_client) textFields.communication_with_client = entityData.communication_with_client;
      if (entityData.additional_info) textFields.additional_info = entityData.additional_info;
      if (entityData.completion_notes) textFields.completion_notes = entityData.completion_notes;
      if (entityData.notes) textFields.notes = entityData.notes;
    } else if (entityType === 'customer') {
      if (entityData.notes) textFields.notes = entityData.notes;
    }
    
    let candidates = extractTextCandidates(textFields, entityType);
    
    // Add structured heuristics
    const structuredCandidates = applyStructuredHeuristics(entityType, entityData, relatedData);
    candidates = [...candidates, ...structuredCandidates];
    
    // Apply score modifiers
    candidates = candidates.map(c => ({
      ...c,
      score: applyScoreModifiers(c, entityData, relatedData)
    }));
    
    // Filter by score threshold
    candidates = candidates.filter(c => c.score >= 30);
    
    // Deduplicate by fingerprint
    const seen = new Set();
    const deduplicated = [];
    
    for (const candidate of candidates) {
      const fingerprint = createFingerprint(candidate.title, candidate.audience, candidate.severity);
      
      // Skip if already active
      if (activeFingerprints.has(fingerprint)) continue;
      
      // Skip if dismissed (unless severity escalates)
      if (dismissedFingerprints.has(fingerprint) && candidate.severity !== 'critical') continue;
      
      // Skip if duplicate in current batch
      if (seen.has(fingerprint)) continue;
      
      seen.add(fingerprint);
      deduplicated.push(candidate);
    }
    
    // Sort by score and apply caps
    const sorted = deduplicated.sort((a, b) => b.score - a.score);
    
    const maxItems = entityType === 'project' ? 5 : 3;
    const suggestions = sorted.slice(0, maxItems);
    
    // Map severity scores to final severity
    const finalSuggestions = suggestions.map(s => ({
      ...s,
      severity: s.score >= 70 ? 'critical' : s.score >= 50 ? 'important' : 'info'
    }));
    
    return Response.json({ 
      success: true,
      suggestions: finalSuggestions,
      total_candidates: candidates.length,
      filtered_count: deduplicated.length
    });
    
  } catch (error) {
    console.error('Error detecting attention items:', error);
    return Response.json({ 
      error: error.message,
      success: false,
      suggestions: []
    }, { status: 500 });
  }
});