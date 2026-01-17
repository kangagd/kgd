import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only function
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[backfillProjectQuoteLinks] Starting backfill process...');

    let projectsUpdated = 0;
    let quotesLinked = 0;
    let quotesInferred = 0;
    let skipped = 0;
    let errors = 0;

    // Step 1: Fetch all quotes with project_id set
    const quotesWithProject = await base44.asServiceRole.entities.Quote.filter({
      project_id: { $exists: true, $ne: null }
    }).catch(() => []);

    console.log(`[backfillProjectQuoteLinks] Found ${quotesWithProject.length} quotes with project_id set`);

    // Group quotes by project_id
    const quotesByProject = {};
    for (const quote of quotesWithProject) {
      if (!quote.project_id) continue;
      if (!quotesByProject[quote.project_id]) {
        quotesByProject[quote.project_id] = [];
      }
      quotesByProject[quote.project_id].push(quote);
    }

    // Step 2: Update each project's quote_ids array
    for (const [projectId, quotes] of Object.entries(quotesByProject)) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
        
        if (!project) {
          console.warn(`[backfillProjectQuoteLinks] Project ${projectId} not found, skipping`);
          skipped++;
          continue;
        }

        const existingQuoteIds = Array.isArray(project.quote_ids) ? project.quote_ids : [];
        const newQuoteIds = quotes.map(q => q.id);
        
        // Merge and dedupe
        const mergedQuoteIds = [...new Set([...existingQuoteIds, ...newQuoteIds])];

        // Only update if changed
        if (mergedQuoteIds.length !== existingQuoteIds.length || 
            !mergedQuoteIds.every(id => existingQuoteIds.includes(id))) {
          
          await base44.asServiceRole.entities.Project.update(projectId, {
            quote_ids: mergedQuoteIds
          });

          projectsUpdated++;
          quotesLinked += (mergedQuoteIds.length - existingQuoteIds.length);
          console.log(`[backfillProjectQuoteLinks] Updated project ${projectId}: added ${mergedQuoteIds.length - existingQuoteIds.length} quote(s)`);
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[backfillProjectQuoteLinks] Error updating project ${projectId}:`, err);
        errors++;
      }
    }

    // Step 3: Optional inference for quotes missing project_id but having job_id
    const quotesWithoutProject = await base44.asServiceRole.entities.Quote.filter({
      project_id: { $exists: false },
      job_id: { $exists: true, $ne: null }
    }).catch(() => []);

    console.log(`[backfillProjectQuoteLinks] Found ${quotesWithoutProject.length} quotes with job_id but no project_id`);

    for (const quote of quotesWithoutProject) {
      try {
        const job = await base44.asServiceRole.entities.Job.get(quote.job_id).catch(() => null);
        
        if (!job || !job.project_id) {
          skipped++;
          continue;
        }

        // 100% confidence inference: job has project_id
        console.log(`[backfillProjectQuoteLinks] Inferring project_id=${job.project_id} for quote ${quote.id} from job ${job.id}`);

        // Update quote with inferred project_id
        await base44.asServiceRole.entities.Quote.update(quote.id, {
          project_id: job.project_id
        });

        // Update project's quote_ids
        const project = await base44.asServiceRole.entities.Project.get(job.project_id).catch(() => null);
        
        if (project) {
          const existingQuoteIds = Array.isArray(project.quote_ids) ? project.quote_ids : [];
          
          if (!existingQuoteIds.includes(quote.id)) {
            await base44.asServiceRole.entities.Project.update(job.project_id, {
              quote_ids: [...existingQuoteIds, quote.id]
            });
            
            quotesInferred++;
            console.log(`[backfillProjectQuoteLinks] Inferred and linked quote ${quote.id} to project ${job.project_id}`);
          }
        }
      } catch (err) {
        console.error(`[backfillProjectQuoteLinks] Error inferring project for quote ${quote.id}:`, err);
        errors++;
      }
    }

    const summary = {
      success: true,
      projects_updated: projectsUpdated,
      quotes_linked: quotesLinked,
      quotes_inferred: quotesInferred,
      skipped,
      errors,
      total_quotes_processed: quotesWithProject.length + quotesWithoutProject.length
    };

    console.log('[backfillProjectQuoteLinks] Backfill complete:', summary);

    return Response.json(summary);

  } catch (error) {
    console.error('[backfillProjectQuoteLinks] CRITICAL ERROR:', error);
    return Response.json({ 
      error: 'Backfill failed',
      details: error.message 
    }, { status: 500 });
  }
});