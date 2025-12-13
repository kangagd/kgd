import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Auth check
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { dryRun = false } = await req.json();

    const stats = {
      customersScanned: 0,
      projectsScanned: 0,
      jobsScanned: 0,
      itemsCreated: 0,
      errors: []
    };

    // Fetch all active entities
    const [customers, projects, jobs] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ deleted_at: null }),
      base44.asServiceRole.entities.Project.filter({ deleted_at: null }),
      base44.asServiceRole.entities.Job.filter({ deleted_at: null, status: { $ne: 'Cancelled' } })
    ]);

    // Process customers
    for (const customer of customers) {
      stats.customersScanned++;
      
      // Delete existing AI-created items to override them
      const existing = await base44.asServiceRole.entities.AttentionItem.filter({
        entity_type: 'customer',
        entity_id: customer.id,
        created_by: 'ai',
        status: 'active'
      });
      
      for (const item of existing) {
        if (!dryRun) {
          await base44.asServiceRole.entities.AttentionItem.delete(item.id);
        }
      }

      try {
        // Gather context
        const customerProjects = projects.filter(p => p.customer_id === customer.id);
        const customerJobs = jobs.filter(j => j.customer_id === customer.id);
        
        const context = {
          notes: customer.notes || '',
          customer_type: customer.customer_type,
          totalProjects: customerProjects.length,
          lostProjects: customerProjects.filter(p => p.status === 'Lost').length,
          completedProjects: customerProjects.filter(p => p.status === 'Completed').length,
          recentNotes: customerProjects.slice(0, 3).map(p => p.notes).filter(Boolean).join('\n')
        };

        // Skip if no meaningful context
        if (!context.notes && !context.recentNotes) continue;

        // Call AI with STRICT minimal guidelines
        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are generating "Attention Items" for KangarooGD (KGD).
This system must feel minimal: at most a few high-signal alerts.

HARD OUTPUT LIMITS (non-negotiable):
- Return at most 2 items for customer
- Max 1 item per category per entity
- If nothing qualifies, return empty items array

STRICT SEVERITY POLICY:
- ONLY create items with severity: "critical" or "high"
- NEVER create "medium" or "low"
- Confidence must be >= 0.88 (otherwise drop)

STRICT ALLOWLIST (ONLY these may create items):
A) PAYMENTS / STOP WORK (category="Payments", audience="office")
   - overdue invoice preventing work, "will not pay", "dispute", "stop work", "do not proceed until paid"
B) CUSTOMER ESCALATION RISK (category="Customer Sentiment", audience="office")
   - "unacceptable", "disgusting", "furious", "angry", "disappointed", "constant delays", "going elsewhere", "cancel", "complaint", "NCAT"
   - Merge all sentiment into ONE item max
C) ACCESS / KEYS / SITE ENTRY (category="Access & Site", audience="tech" or "both")
   - keys to collect/return, lockbox/code, tenant contact, restricted hours, strata booking, parking constraints, pets, alarms
D) SAFETY HAZARD (category="Safety", audience="tech")
   - asbestos, unsafe ceiling/ladder access, live electrical hazard, unstable structure
E) HARD TECHNICAL BLOCKER (category="Technical Constraint", audience="tech" or "both")
   - noggins/blocking missing, "no fixing points", "low headroom", "front mount required", powdercoat defect, motor compatibility blocker
F) LOGISTICS BLOCKER (category="Logistics Blocker", audience="office")
   - parts not shipped, backorder blocking scheduling, wrong items delivered, ETA missed
G) HARD DEADLINE (category="Deadline", audience="both")
   - tenant move-in, builder handover, strata deadline (must include explicit date)

BAN LIST (auto-drop):
- "ensure remote works", "communicate with client", "confirm timeline", "recommend new remotes", "verify X"
- generic quality reminders, job summaries

Customer: ${customer.name}
Type: ${context.customer_type || 'N/A'}
Notes: ${context.notes}
Projects: ${context.totalProjects} total, ${context.lostProjects} lost, ${context.completedProjects} completed
Recent Project Notes: ${context.recentNotes || 'None'}

Return ONLY items matching allowlist with confidence >= 0.88. Usually 0-2 items.`,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    category: { type: 'string' },
                    audience: { type: 'string' },
                    severity: { type: 'string' },
                    confidence: { type: 'number' },
                    summary_bullets: { type: 'array', items: { type: 'string' } },
                    evidence_quote: { type: 'string' },
                    evidence_source: { type: 'string' }
                  }
                }
              },
              dropped_reasons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string' },
                    example: { type: 'string' }
                  }
                }
              }
            }
          }
        });

        const items = aiResponse?.items || [];
        
        // Filter by confidence threshold and severity
        const validItems = items.filter(item => 
          item.confidence >= 0.88 && 
          (item.severity === 'critical' || item.severity === 'high')
        );
        
        // Create attention items (max 2 for customer)
        for (const item of validItems.slice(0, 2)) {
          if (!dryRun) {
            await base44.asServiceRole.entities.AttentionItem.create({
              entity_type: 'customer',
              entity_id: customer.id,
              title: item.title,
              summary: item.summary_bullets?.join('\n') || item.summary || '',
              category: item.category,
              severity: item.severity,
              audience: item.audience,
              evidence: [{
                source_type: item.evidence_source || 'other',
                source_id: customer.id,
                excerpt: item.evidence_quote || ''
              }],
              created_by: 'ai',
              status: 'active',
              score: Math.round(item.confidence * 100)
            });
            stats.itemsCreated++;
          } else {
            console.log(`[DRY RUN] Customer ${customer.name}: ${item.title} (confidence: ${item.confidence})`);
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        stats.errors.push(`Customer ${customer.id}: ${error.message}`);
      }
    }

    // Process projects
    for (const project of projects) {
      stats.projectsScanned++;
      
      const existing = await base44.asServiceRole.entities.AttentionItem.filter({
        entity_type: 'project',
        entity_id: project.id,
        created_by: 'ai',
        status: 'active'
      });
      
      for (const item of existing) {
        if (!dryRun) {
          await base44.asServiceRole.entities.AttentionItem.delete(item.id);
        }
      }

      try {
        const projectJobs = jobs.filter(j => j.project_id === project.id);
        const parts = await base44.asServiceRole.entities.Part.filter({ project_id: project.id });
        
        const context = {
          description: project.description || '',
          notes: project.notes || '',
          status: project.status,
          financial_status: project.financial_status,
          delayed: project.status === 'Completed' && project.completed_date ? 
            new Date(project.completed_date) - new Date(project.created_date || project.created_at) > 30 * 24 * 60 * 60 * 1000 : false,
          partsIssues: parts.filter(p => ['back-ordered', 'cancelled'].includes(p.status)).length,
          jobOutcomes: projectJobs.map(j => j.outcome).filter(Boolean)
        };

        if (!context.description && !context.notes && context.partsIssues === 0) continue;

        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are generating "Attention Items" for KangarooGD (KGD).
This system must feel minimal: at most a few high-signal alerts.

HARD OUTPUT LIMITS: Max 3 items for project, max 1 item per category
STRICT SEVERITY: ONLY "critical" or "high", confidence >= 0.88

STRICT ALLOWLIST (ONLY these may create items):
A) PAYMENTS / STOP WORK - overdue invoice preventing work
B) CUSTOMER ESCALATION RISK - explicit strong negative language: "unacceptable", "furious", "angry", "cancel", "complaint"
C) ACCESS / KEYS / SITE ENTRY - keys, codes, tenant contact, restricted hours, parking
D) SAFETY HAZARD - asbestos, unsafe access, electrical hazard
E) HARD TECHNICAL BLOCKER - noggins missing, low headroom, motor compatibility blocker
F) LOGISTICS BLOCKER - parts not shipped blocking scheduling
G) HARD DEADLINE - tenant move-in, builder handover with explicit date

Project: ${project.title}
Status: ${context.status}
Financial: ${context.financial_status || 'N/A'}
Description: ${context.description}
Notes: ${context.notes}
Parts Issues: ${context.partsIssues}
Job Outcomes: ${context.jobOutcomes.join(', ')}

Return ONLY items matching allowlist with confidence >= 0.88. Usually 0-3 items.`,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    category: { type: 'string' },
                    audience: { type: 'string' },
                    severity: { type: 'string' },
                    confidence: { type: 'number' },
                    summary_bullets: { type: 'array', items: { type: 'string' } },
                    evidence_quote: { type: 'string' },
                    evidence_source: { type: 'string' }
                  }
                }
              }
            }
          }
        });

        const items = aiResponse?.items || [];
        const validItems = items.filter(item => 
          item.confidence >= 0.88 && 
          (item.severity === 'critical' || item.severity === 'high')
        );
        
        for (const item of validItems.slice(0, 3)) {
          if (!dryRun) {
            await base44.asServiceRole.entities.AttentionItem.create({
              entity_type: 'project',
              entity_id: project.id,
              title: item.title,
              summary: item.summary_bullets?.join('\n') || item.summary || '',
              category: item.category,
              severity: item.severity,
              audience: item.audience,
              evidence: [{
                source_type: item.evidence_source || 'other',
                source_id: project.id,
                excerpt: item.evidence_quote || ''
              }],
              created_by: 'ai',
              status: 'active',
              score: Math.round(item.confidence * 100)
            });
            stats.itemsCreated++;
          } else {
            console.log(`[DRY RUN] Project ${project.title}: ${item.title} (confidence: ${item.confidence})`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        stats.errors.push(`Project ${project.id}: ${error.message}`);
      }
    }

    // Process jobs
    for (const job of jobs) {
      stats.jobsScanned++;
      
      const existing = await base44.asServiceRole.entities.AttentionItem.filter({
        entity_type: 'job',
        entity_id: job.id,
        created_by: 'ai',
        status: 'active'
      });
      
      for (const item of existing) {
        if (!dryRun) {
          await base44.asServiceRole.entities.AttentionItem.delete(item.id);
        }
      }

      try {
        const context = {
          overview: job.overview || '',
          outcome: job.outcome || '',
          next_steps: job.next_steps || '',
          communication: job.communication_with_client || '',
          additional: job.additional_info || '',
          completion_notes: job.completion_notes || ''
        };

        const hasContent = Object.values(context).some(v => v && v.length > 10);
        if (!hasContent) continue;

        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are generating "Attention Items" for KangarooGD (KGD).
This system must feel minimal: at most a few high-signal alerts.

HARD OUTPUT LIMITS: Max 2 items for job, max 1 item per category
STRICT SEVERITY: ONLY "critical" or "high", confidence >= 0.88

STRICT ALLOWLIST (ONLY these may create items):
A) PAYMENTS / STOP WORK - overdue invoice preventing work
B) CUSTOMER ESCALATION RISK - "unacceptable", "furious", "angry", "cancel", "complaint", "NCAT"
C) ACCESS / KEYS / SITE ENTRY - keys to collect/return, lockbox/code, tenant contact, restricted hours
D) SAFETY HAZARD - asbestos, unsafe ceiling/ladder access, live electrical hazard
E) HARD TECHNICAL BLOCKER - noggins missing, "no fixing points", "low headroom", "60mm headroom", "front mount required", motor compatibility blocker
F) LOGISTICS BLOCKER - parts not shipped blocking scheduled job
G) HARD DEADLINE - tenant move-in, builder handover with explicit date

BAN LIST: "ensure remote works", "communicate with client", "confirm timeline", "verify X"

Job: #${job.job_number}
Overview: ${context.overview}
Outcome: ${context.outcome}
Next Steps: ${context.next_steps}
Communication: ${context.communication}
Completion Notes: ${context.completion_notes}

Return ONLY items matching allowlist with confidence >= 0.88. Usually 0-2 items.`,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    category: { type: 'string' },
                    audience: { type: 'string' },
                    severity: { type: 'string' },
                    confidence: { type: 'number' },
                    summary_bullets: { type: 'array', items: { type: 'string' } },
                    evidence_quote: { type: 'string' },
                    evidence_source: { type: 'string' }
                  }
                }
              }
            }
          }
        });

        const items = aiResponse?.items || [];
        const validItems = items.filter(item => 
          item.confidence >= 0.88 && 
          (item.severity === 'critical' || item.severity === 'high')
        );
        
        for (const item of validItems.slice(0, 2)) {
          if (!dryRun) {
            await base44.asServiceRole.entities.AttentionItem.create({
              entity_type: 'job',
              entity_id: job.id,
              title: item.title,
              summary: item.summary_bullets?.join('\n') || item.summary || '',
              category: item.category,
              severity: item.severity,
              audience: item.audience,
              evidence: [{
                source_type: item.evidence_source || 'other',
                source_id: job.id,
                excerpt: item.evidence_quote || ''
              }],
              created_by: 'ai',
              status: 'active',
              score: Math.round(item.confidence * 100)
            });
            stats.itemsCreated++;
          } else {
            console.log(`[DRY RUN] Job #${job.job_number}: ${item.title} (confidence: ${item.confidence})`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        stats.errors.push(`Job ${job.id}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      dryRun,
      stats,
      message: dryRun 
        ? 'Dry run complete - no records created' 
        : `Created ${stats.itemsCreated} attention items`
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});