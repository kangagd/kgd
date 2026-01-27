import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * backfillJobType - Safe JobType backfill with dryRun + confidence scoring
 * 
 * Admin-only function to infer and assign JobType to jobs missing job_type_id.
 * Uses deterministic rules first, fallback to AI only if needed.
 * 
 * Signature:
 *   {
 *     dryRun: true,                    // default: true (dry run only)
 *     limit: 200,                      // max jobs to process
 *     include_job_ids: [],             // filter to specific job IDs
 *     exclude_job_ids: [],             // exclude job IDs
 *     apply_low_confidence: false      // allow applying LOW confidence (dangerous)
 *   }
 */

// Deterministic rules: keywords → JobType evidence
const JOB_TYPE_RULES = [
  {
    patterns: ['measure', 'site measure', 'measure up', 'survey', 'inspection'],
    keywords: ['site visit', 'assess', 'evaluate'],
    jobTypeKeywords: ['measure', 'survey', 'site visit'],
    confidence: 'HIGH'
  },
  {
    patterns: ['install', 'installation', 'fit off', 'handover', 'new door', 'new gate', 'fit new'],
    keywords: ['door', 'gate', 'motor', 'installer'],
    jobTypeKeywords: ['install', 'installation'],
    confidence: 'HIGH'
  },
  {
    patterns: ['repair', 'fix', 'service', 'fault', 'broken', 'stuck', 'won\'t', 'service call'],
    keywords: ['issue', 'problem', 'malfunction', 'callback'],
    jobTypeKeywords: ['repair', 'service', 'fix'],
    confidence: 'HIGH'
  },
  {
    patterns: ['warranty', 'callback', 'adjustment', 'warranty work'],
    keywords: ['under warranty', 'warranty issue'],
    jobTypeKeywords: ['warranty', 'callback'],
    confidence: 'MEDIUM'
  },
  {
    patterns: ['deliver', 'delivery', 'pickup', 'collect', 'warehouse', 'logistics', 'transport'],
    keywords: ['stock', 'inventory', 'vehicle'],
    jobTypeKeywords: ['logistics', 'delivery', 'pickup'],
    confidence: 'HIGH'
  }
];

/**
 * Apply deterministic rules to infer JobType
 */
function matchRules(jobTitle, jobNotes, projectDesc, visitNotes, emailSubject) {
  const fullText = [jobTitle, jobNotes, projectDesc, visitNotes, emailSubject]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matches = [];

  for (const rule of JOB_TYPE_RULES) {
    let patternMatches = 0;
    let keywordMatches = 0;

    // Count pattern matches
    for (const pattern of rule.patterns) {
      if (fullText.includes(pattern)) {
        patternMatches++;
      }
    }

    // Count keyword matches
    for (const keyword of rule.keywords) {
      if (fullText.includes(keyword)) {
        keywordMatches++;
      }
    }

    // Score: need at least 1 pattern match for HIGH confidence, 1+ keyword for corroboration
    if (patternMatches > 0) {
      const isHighConfidence = patternMatches >= 1 && keywordMatches >= 1;
      matches.push({
        jobTypeKeywords: rule.jobTypeKeywords,
        patternMatches,
        keywordMatches,
        confidence: isHighConfidence ? 'HIGH' : keywordMatches > 0 ? 'MEDIUM' : 'LOW',
        matchedPatterns: rule.patterns.filter(p => fullText.includes(p))
      });
    }
  }

  return matches;
}

/**
 * Find matching JobType by keywords
 */
async function findJobTypeByKeywords(base44, keywords) {
  const jobTypes = await base44.asServiceRole.entities.JobType.list();

  // Try exact name match first
  for (const keyword of keywords) {
    const exact = jobTypes.find(
      jt => jt.name && jt.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (exact) return exact;
  }

  // Fallback: fuzzy match
  for (const keyword of keywords) {
    const fuzzy = jobTypes.find(
      jt => jt.name && keyword.toLowerCase().includes(jt.name.toLowerCase().substring(0, 3))
    );
    if (fuzzy) return fuzzy;
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({
        error: 'Forbidden: Admin access required',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const body = await req.json();
    const {
      dryRun = true,
      limit = 200,
      include_job_ids = [],
      exclude_job_ids = [],
      apply_low_confidence = false
    } = body;

    const isDryRun = dryRun !== false && dryRun !== 'false';

    console.log(`[backfillJobType] Starting (dryRun=${isDryRun}, limit=${limit})`);

    // ========================================
    // 1. Find jobs missing job_type_id
    // ========================================
    let allJobs = await base44.asServiceRole.entities.Job.list(undefined, 9999);
    
    // Filter to missing job_type_id
    let missingJobs = allJobs.filter(j => !j.job_type_id);

    // Apply include/exclude filters
    if (include_job_ids.length > 0) {
      missingJobs = missingJobs.filter(j => include_job_ids.includes(j.id));
    }
    if (exclude_job_ids.length > 0) {
      missingJobs = missingJobs.filter(j => !exclude_job_ids.includes(j.id));
    }

    // Apply limit
    missingJobs = missingJobs.slice(0, limit);

    console.log(`[backfillJobType] Found ${missingJobs.length} jobs missing job_type_id`);

    // ========================================
    // 2. For each job, infer best JobType
    // ========================================
    const proposed = [];
    const skipped = [];

    for (const job of missingJobs) {
      try {
        // Gather evidence
        let project = null;
        let lastVisit = null;
        let lastJobMessage = null;
        let linkedThreads = [];

        if (job.project_id) {
          project = await base44.asServiceRole.entities.Project.get(job.project_id).catch(() => null);
        }

        const visits = await base44.asServiceRole.entities.Visit.filter({
          job_id: job.id
        }, '-created_date', 1);
        lastVisit = visits.length > 0 ? visits[0] : null;

        const messages = await base44.asServiceRole.entities.JobMessage.filter({
          job_id: job.id
        }, '-created_date', 1);
        lastJobMessage = messages.length > 0 ? messages[0] : null;

        if (job.project_id) {
          linkedThreads = await base44.asServiceRole.entities.EmailThread.filter({
            project_id: job.project_id
          }, '-last_message_date', 3);
        }

        // Build evidence snippets
        const jobTitle = job.title || job.job_type_name || '';
        const jobNotes = job.notes || job.overview || '';
        const projectDesc = project ? (project.description || project.title || '') : '';
        const visitNotes = lastVisit ? (lastVisit.overview || lastVisit.notes || '') : '';
        const emailSubjects = linkedThreads.map(t => t.subject || '').join(' ');

        // Apply deterministic rules
        const ruleMatches = matchRules(jobTitle, jobNotes, projectDesc, visitNotes, emailSubjects);

        if (ruleMatches.length === 0) {
          skipped.push({
            job_id: job.id,
            reason: 'no_rule_matches'
          });
          continue;
        }

        // Pick best match (highest confidence, most matches)
        const bestMatch = ruleMatches.reduce((a, b) => {
          const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          const aScore = confidenceOrder[a.confidence] * 10 + a.patternMatches + a.keywordMatches;
          const bScore = confidenceOrder[b.confidence] * 10 + b.patternMatches + b.keywordMatches;
          return aScore >= bScore ? a : b;
        });

        // Find matching JobType
        const jobType = await findJobTypeByKeywords(base44, bestMatch.jobTypeKeywords);

        if (!jobType) {
          skipped.push({
            job_id: job.id,
            reason: `no_jobtype_found_for_${bestMatch.jobTypeKeywords.join('_')}`
          });
          continue;
        }

        // Build proposal
        proposed.push({
          job_id: job.id,
          job_number: job.job_number,
          proposed_job_type_id: jobType.id,
          proposed_job_type_name: jobType.name,
          confidence: bestMatch.confidence,
          reasons: [
            `Matched patterns: ${bestMatch.matchedPatterns.join(', ')}`,
            `Pattern matches: ${bestMatch.patternMatches}, Keyword matches: ${bestMatch.keywordMatches}`,
            `Inferred type: ${jobType.name}`
          ],
          evidence: {
            job_title: jobTitle.substring(0, 60),
            job_snippet: jobNotes.substring(0, 80),
            project_snippet: projectDesc.substring(0, 80),
            last_visit_snippet: visitNotes.substring(0, 80),
            last_email_subject: linkedThreads[0]?.subject || null
          }
        });
      } catch (error) {
        console.error(`[backfillJobType] Error processing job ${job.id}:`, error);
        skipped.push({
          job_id: job.id,
          reason: `error: ${error.message}`
        });
      }
    }

    // ========================================
    // 3. Apply if requested
    // ========================================
    let applied_count = 0;

    if (!isDryRun) {
      for (const prop of proposed) {
        // Skip LOW confidence unless explicitly allowed
        if (prop.confidence === 'LOW' && !apply_low_confidence) {
          console.log(`[backfillJobType] Skipping LOW confidence: job ${prop.job_id}`);
          continue;
        }

        try {
          // Update Job
          await base44.asServiceRole.entities.Job.update(prop.job_id, {
            job_type_id: prop.proposed_job_type_id,
            job_type: prop.proposed_job_type_name,
            job_type_name: prop.proposed_job_type_name
          });

          // Write ChangeHistory
          await base44.asServiceRole.entities.ChangeHistory.create({
            job_id: prop.job_id,
            field_name: 'job_type_id',
            old_value: null,
            new_value: prop.proposed_job_type_id,
            changed_by: user.email,
            changed_by_name: user.full_name || user.display_name || user.email,
            notes: `Backfilled via backfillJobType (confidence: ${prop.confidence})`
          });

          // Optional: add internal note
          await base44.asServiceRole.entities.JobMessage.create({
            job_id: prop.job_id,
            message_type: 'internal',
            body: `Job Type auto-set to "${prop.proposed_job_type_name}" (confidence: ${prop.confidence}). Please review.`,
            created_by_email: user.email,
            created_by_name: user.full_name || user.display_name || user.email
          });

          applied_count++;
        } catch (error) {
          console.error(`[backfillJobType] Failed to apply for job ${prop.job_id}:`, error);
        }
      }
    }

    // ========================================
    // 4. Return summary
    // ========================================
    const summary = {
      success: true,
      dryRun: isDryRun,
      found: missingJobs.length,
      proposed: proposed,
      skipped: skipped,
      applied_count: applied_count,
      stats: {
        high_confidence: proposed.filter(p => p.confidence === 'HIGH').length,
        medium_confidence: proposed.filter(p => p.confidence === 'MEDIUM').length,
        low_confidence: proposed.filter(p => p.confidence === 'LOW').length,
        total_proposed: proposed.length,
        skipped_count: skipped.length
      }
    };

    console.log(`[backfillJobType] Complete:`, summary.stats);

    return Response.json(summary);
  } catch (error) {
    console.error('[backfillJobType] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});