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

        // Call AI with strict exception-only guidelines
        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are generating "Attention Items" for KangarooGD (KGD).
ATTENTION ITEMS ARE EXCEPTIONS ONLY — NOT summaries, reminders, or general advice.

Create an Attention Item ONLY if it will materially change how the team should:
1) Schedule/plan a visit (timing, parts, resourcing, pre-work)
2) Attend site (access, safety, keys, parking, pets, strata rules)
3) Communicate (customer frustration, strict requirements, escalation risk)
4) Handle payments/credit risk (overdue invoice, payment dispute, stop-work)
5) Handle technical constraints (low headroom, noggins missing, wrong structure, compatibility issues)
6) Handle supplier/logistics constraints that block delivery/installation (critical backorder, wrong item delivered)

If the content is "normal" or "nice-to-have", DO NOT create an attention item.

Customer: ${customer.name}
Type: ${context.customer_type || 'N/A'}
Notes: ${context.notes}
Projects: ${context.totalProjects} total, ${context.lostProjects} lost, ${context.completedProjects} completed
Recent Project Notes: ${context.recentNotes || 'None'}

Rules:
- Max 3 items for customer
- Only create if confidence >= 0.72
- Never create "low" severity items (only critical/high/medium)
- Must have exact evidence quote (max 180 chars)
- Ban list: do NOT create items for generic advice like "ensure good communication", "verify remote functionality", "confirm timeline"
- Title: 3-7 words, plain English, no punctuation at end
- Summary: 1-2 bullet points, actionable
- Categories: ["Access & Site","Customer Sentiment","Payments","Technical Constraint","Safety","Logistics Blocker","Deadline","Risk","Other"]
- Audience: "tech" | "office" | "both"

Return ONLY exception-level items with confidence >= 0.72.`,
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
        
        // Filter by confidence threshold
        const validItems = items.filter(item => item.confidence >= 0.72);
        
        // Create attention items
        for (const item of validItems.slice(0, 3)) {
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
ATTENTION ITEMS ARE EXCEPTIONS ONLY — NOT summaries, reminders, or general advice.

Create an Attention Item ONLY if it will materially change how the team should:
1) Schedule/plan a visit (timing, parts, resourcing, pre-work)
2) Attend site (access, safety, keys, parking, pets, strata rules)
3) Communicate (customer frustration, strict requirements, escalation risk)
4) Handle payments/credit risk (overdue invoice, payment dispute, stop-work)
5) Handle technical constraints (low headroom, noggins missing, wrong structure, compatibility issues)
6) Handle supplier/logistics constraints that block delivery/installation (critical backorder, wrong item delivered)

Project: ${project.title}
Status: ${context.status}
Financial: ${context.financial_status || 'N/A'}
Description: ${context.description}
Notes: ${context.notes}
Parts Issues: ${context.partsIssues}
Job Outcomes: ${context.jobOutcomes.join(', ')}

Rules:
- Max 5 items for project
- Only create if confidence >= 0.72
- Never create "low" severity items
- Must have exact evidence quote (max 180 chars)
- Ban list: do NOT create generic advice items
- Categories: ["Access & Site","Customer Sentiment","Payments","Technical Constraint","Safety","Logistics Blocker","Deadline","Risk","Other"]

Return ONLY exception-level items with confidence >= 0.72.`,
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
        const validItems = items.filter(item => item.confidence >= 0.72);
        
        for (const item of validItems.slice(0, 5)) {
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
ATTENTION ITEMS ARE EXCEPTIONS ONLY — NOT summaries, reminders, or general advice.

Create an Attention Item ONLY if it will materially change how the team should:
1) Schedule/plan a visit (timing, parts, resourcing, pre-work)
2) Attend site (access, safety, keys, parking, pets, strata rules)
3) Communicate (customer frustration, strict requirements, escalation risk)
4) Handle payments/credit risk (overdue invoice, payment dispute, stop-work)
5) Handle technical constraints (low headroom, noggins missing, wrong structure, compatibility issues)
6) Handle supplier/logistics constraints that block delivery/installation (critical backorder, wrong item delivered)

Job: #${job.job_number}
Overview: ${context.overview}
Outcome: ${context.outcome}
Next Steps: ${context.next_steps}
Communication: ${context.communication}
Completion Notes: ${context.completion_notes}

KGD-specific high-signal triggers:
A) Access & site constraints (keys, codes, pets, parking, strata, tenant, safety hazards)
B) Customer sentiment risk (frustrated/angry/threatening cancellation)
C) Payment/credit risk (overdue invoice, stop-work condition)
D) Technical blockers: "low headroom", "60mm headroom", "front mount", "noggins", "blocking", "structure required", "no fixing points", motor compatibility issues
E) Hard deadlines / move-in dates (tenant moving in, builder handover) ONLY if date-bound

Rules:
- Max 3 items for job
- Only create if confidence >= 0.72
- Never create "low" severity items
- Must have exact evidence quote (max 180 chars)

Return ONLY exception-level items with confidence >= 0.72.`,
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
        const validItems = items.filter(item => item.confidence >= 0.72);
        
        for (const item of validItems.slice(0, 3)) {
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