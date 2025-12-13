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
      
      // Skip if already has backfill items
      const existing = await base44.asServiceRole.entities.AttentionItem.filter({
        entity_type: 'customer',
        entity_id: customer.id,
        created_by: 'ai'
      });
      
      if (existing.length > 0) continue;

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

        // Call AI
        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are analysing historical service data for a garage door business.

Customer: ${customer.name}
Type: ${context.customer_type || 'N/A'}
Notes: ${context.notes}
Projects: ${context.totalProjects} total, ${context.lostProjects} lost, ${context.completedProjects} completed
Recent Project Notes: ${context.recentNotes || 'None'}

Identify IMPORTANT ATTENTION ITEMS that would affect:
- Office handling (payments, delays, customer sentiment, risk)
- Technician attendance (access, safety, site constraints)

Rules:
- Only create an item if genuinely important
- Keep language short, plain, and direct
- Max 3 items per entity
- If nothing important, return empty list

For each item return JSON with:
- title (max 8 words)
- summary (1-2 short sentences)
- category (one of: Customer Sentiment, Payments, Access & Site, Risk, Operational, Other)
- audience ("office", "technician", or "both")
- severity ("info", "important", or "critical")
- evidence (exact text snippets)`,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    category: { type: 'string' },
                    audience: { type: 'string' },
                    severity: { type: 'string' },
                    evidence: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        });

        const items = aiResponse?.items || [];
        
        // Create attention items
        for (const item of items.slice(0, 3)) {
          if (!dryRun) {
            await base44.asServiceRole.entities.AttentionItem.create({
              entity_type: 'customer',
              entity_id: customer.id,
              title: item.title,
              summary: item.summary,
              category: item.category,
              severity: item.severity,
              audience: item.audience,
              evidence: item.evidence.map(e => ({
                source_type: 'backfill',
                excerpt: e
              })),
              created_by: 'ai',
              status: 'active'
            });
            stats.itemsCreated++;
          } else {
            console.log(`[DRY RUN] Customer ${customer.name}: ${item.title}`);
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
        created_by: 'ai'
      });
      
      if (existing.length > 0) continue;

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
          prompt: `You are analysing project data for a garage door business.

Project: ${project.title}
Status: ${context.status}
Financial: ${context.financial_status || 'N/A'}
Description: ${context.description}
Notes: ${context.notes}
Parts Issues: ${context.partsIssues}
Job Outcomes: ${context.jobOutcomes.join(', ')}

Identify IMPORTANT ATTENTION ITEMS. Max 3 items. Return JSON.`,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    category: { type: 'string' },
                    audience: { type: 'string' },
                    severity: { type: 'string' },
                    evidence: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        });

        const items = aiResponse?.items || [];
        
        for (const item of items.slice(0, 3)) {
          if (!dryRun) {
            await base44.asServiceRole.entities.AttentionItem.create({
              entity_type: 'project',
              entity_id: project.id,
              title: item.title,
              summary: item.summary,
              category: item.category,
              severity: item.severity,
              audience: item.audience,
              evidence: item.evidence.map(e => ({
                source_type: 'backfill',
                excerpt: e
              })),
              created_by: 'ai',
              status: 'active'
            });
            stats.itemsCreated++;
          } else {
            console.log(`[DRY RUN] Project ${project.title}: ${item.title}`);
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
        created_by: 'ai'
      });
      
      if (existing.length > 0) continue;

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
          prompt: `You are analysing job data for a garage door business.

Job: #${job.job_number}
Overview: ${context.overview}
Outcome: ${context.outcome}
Next Steps: ${context.next_steps}
Communication: ${context.communication}
Completion Notes: ${context.completion_notes}

Identify IMPORTANT ATTENTION ITEMS. Max 3 items. Return JSON.`,
          response_json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    category: { type: 'string' },
                    audience: { type: 'string' },
                    severity: { type: 'string' },
                    evidence: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        });

        const items = aiResponse?.items || [];
        
        for (const item of items.slice(0, 3)) {
          if (!dryRun) {
            await base44.asServiceRole.entities.AttentionItem.create({
              entity_type: 'job',
              entity_id: job.id,
              title: item.title,
              summary: item.summary,
              category: item.category,
              severity: item.severity,
              audience: item.audience,
              evidence: item.evidence.map(e => ({
                source_type: 'backfill',
                excerpt: e
              })),
              created_by: 'ai',
              status: 'active'
            });
            stats.itemsCreated++;
          } else {
            console.log(`[DRY RUN] Job #${job.job_number}: ${item.title}`);
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