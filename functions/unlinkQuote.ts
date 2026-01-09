import { createClientFromRequest } from './shared/sdk.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can unlink quotes' }, { status: 403 });
    }

    const body = await req.json();
    const { quote_id } = normalizeParams(body);
    const quoteId = quote_id || body.quoteId;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Get the quote to see what it's linked to
    const quote = await base44.asServiceRole.entities.Quote.get(quoteId);
    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const projectId = quote.project_id;
    const jobId = quote.job_id;

    // STEP 1: Clear quote's project/job references
    await base44.asServiceRole.entities.Quote.update(quoteId, {
      project_id: null,
      job_id: null
    });

    // STEP 2: Remove from project's quote_ids array and clear primary if needed
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      
      if (project) {
        const updates = {};
        
        // Remove from quote_ids array
        if (project.quote_ids && project.quote_ids.includes(quoteId)) {
          updates.quote_ids = project.quote_ids.filter(id => id !== quoteId);
        }
        
        // Clear primary if this was the primary quote
        if (project.primary_quote_id === quoteId) {
          updates.primary_quote_id = null;
        }
        
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Project.update(projectId, updates);
        }
      }
    }

    // STEP 3: Scan for any other projects that might reference this quote (ghost links)
    const allProjects = await base44.asServiceRole.entities.Project.filter({});
    
    for (const proj of allProjects) {
      if (proj.id !== projectId) {
        let needsUpdate = false;
        const updates = {};
        
        // Check quote_ids array
        if (proj.quote_ids && proj.quote_ids.includes(quoteId)) {
          updates.quote_ids = proj.quote_ids.filter(id => id !== quoteId);
          needsUpdate = true;
        }
        
        // Check primary_quote_id
        if (proj.primary_quote_id === quoteId) {
          updates.primary_quote_id = null;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await base44.asServiceRole.entities.Project.update(proj.id, updates);
        }
      }
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('unlinkQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});