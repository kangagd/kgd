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

    // STEP 2: Clear primary_quote_id on project if this was primary
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      if (project.primary_quote_id === quoteId) {
        await base44.asServiceRole.entities.Project.update(projectId, {
          primary_quote_id: null
        });
      }
    }

    // STEP 3: Scan for any other projects that might reference this quote (ghost links)
    const allProjects = await base44.asServiceRole.entities.Project.filter({
      primary_quote_id: quoteId
    });

    for (const proj of allProjects) {
      if (proj.id !== projectId) {
        await base44.asServiceRole.entities.Project.update(proj.id, {
          primary_quote_id: null
        });
      }
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('unlinkQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});