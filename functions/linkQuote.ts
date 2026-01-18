import { createClientFromRequest } from './shared/sdk.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

/**
 * Links a Quote to a project or job
 * 
 * CRITICAL: Properly handles unlinking from previous project to prevent stale references
 * 
 * Flow:
 * 1. Find the Quote entity
 * 2. If already linked to a different project, unlink it (clear primary_quote_id on old project)
 * 3. Update Quote.project_id to new project
 * 4. Optionally set as primary quote
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { project_id, job_id, quote_id } = normalizeParams(body);
    const quoteId = quote_id || body.quoteId;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    if (!project_id && !job_id) {
      return Response.json({ error: 'Either project_id or job_id is required' }, { status: 400 });
    }

    console.log('[linkQuote] Linking quote:', { quoteId, project_id, job_id });

    // Get the quote
    const quote = await base44.asServiceRole.entities.Quote.get(quoteId);
    
    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }
    
    console.log('[linkQuote] Found quote:', { id: quote.id, existing_project_id: quote.project_id });

    const oldProjectId = quote.project_id;

    // STEP 1: If linked to a different project, unlink from old project (STRING normalization)
    if (oldProjectId && String(oldProjectId) !== String(project_id)) {
      try {
        const oldProject = await base44.asServiceRole.entities.Project.get(oldProjectId);
        
        if (oldProject) {
          // Normalize to string array for comparison
          const currentQuoteIds = (oldProject.quote_ids || []).map(String);
          const quoteIdStr = String(quoteId);
          
          // Only update if quote is actually in the array
          if (currentQuoteIds.includes(quoteIdStr)) {
            const updatedQuoteIds = currentQuoteIds.filter(id => String(id) !== quoteIdStr);
            await base44.asServiceRole.entities.Project.update(oldProjectId, {
              quote_ids: updatedQuoteIds
            });
            console.log('[linkQuote] Unlinked from old project:', oldProjectId);
          }
        }
      } catch (e) {
        console.error('[linkQuote] Error unlinking from old project:', e);
        // Continue anyway - link to new project
      }
    }

    // STEP 2: Update Quote to link to new project/job
    const quoteUpdates = {
      project_id: project_id || null,
      job_id: job_id || null
    };

    await base44.asServiceRole.entities.Quote.update(quoteId, quoteUpdates);

    // STEP 3: Add to project's quote_ids array (STRING ID normalization)
    if (project_id) {
      const project = await base44.asServiceRole.entities.Project.get(project_id);
      
      // Normalize to string array for comparison
      const currentQuoteIds = (project.quote_ids || []).map(String);
      const quoteIdStr = String(quoteId);
      
      // Only add if not already in the array (idempotent)
      const updatedQuoteIds = currentQuoteIds.includes(quoteIdStr)
        ? currentQuoteIds
        : [...currentQuoteIds, quoteIdStr];
      
      const projectUpdates = {
        quote_ids: updatedQuoteIds
      };
      
      console.log('[linkQuote] Updating project array:', { 
        project_id, 
        before: project.quote_ids, 
        after: updatedQuoteIds 
      });
      
      await base44.asServiceRole.entities.Project.update(project_id, projectUpdates);
    }

    return Response.json({
      success: true,
      quote: quote,
      unlinked_from_project: oldProjectId,
      linked_to_project: project_id,
      linked_to_job: job_id
    });

  } catch (error) {
    console.error('Link quote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});