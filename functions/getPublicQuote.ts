import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Use service role to fetch quote and related data without authentication
    const quotes = await base44.asServiceRole.entities.Quote.filter({ 
      public_share_token: token 
    });

    if (quotes.length === 0) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const quote = quotes[0];

    // Fetch related items
    const quoteItems = await base44.asServiceRole.entities.QuoteItem.filter({ 
      quote_id: quote.id 
    });

    const quoteSections = await base44.asServiceRole.entities.QuoteSection.filter({ 
      quote_id: quote.id 
    });

    return Response.json({ 
      quote, 
      quoteItems, 
      quoteSections 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});