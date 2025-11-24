import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const token = body.token;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const base44 = createClientFromRequest(req);

    // Use service role to fetch quote and related data without authentication
    const quotes = await base44.asServiceRole.entities.Quote.filter({ 
      public_share_token: token 
    });

    if (quotes.length === 0) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const quote = quotes[0];

    // Fetch related items
    const quoteItems = await base44.asServiceRole.entities.QuoteItem.filter({ 
      quote_id: quote.id 
    });

    const quoteSections = await base44.asServiceRole.entities.QuoteSection.filter({ 
      quote_id: quote.id 
    });

    return new Response(JSON.stringify({ 
      quote, 
      quoteItems, 
      quoteSections 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});