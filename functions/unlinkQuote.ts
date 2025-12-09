import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
    const { quoteId } = body;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Get the quote to see what it's linked to
    const quote = await base44.asServiceRole.entities.Quote.get(quoteId);
    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const projectId = quote.project_id;

    // Delete the quote
    await base44.asServiceRole.entities.Quote.delete(quoteId);

    // If this was the primary quote on a project, clear that reference
    if (projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      if (project.primary_quote_id === quoteId) {
        await base44.asServiceRole.entities.Project.update(projectId, {
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