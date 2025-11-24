import { createClient } from 'npm:@base44/sdk@0.8.4';

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

    // Use service role client - no authentication required for public access
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    );

    // Fetch quote and related data
    const quotes = await base44.entities.Quote.filter({ 
      public_share_token: token 
    });

    if (!quotes || quotes.length === 0) {
      return new Response(JSON.stringify({ error: 'Quote not found or token invalid' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const quote = quotes[0];

    // Update status to Viewed if currently Sent
    if (quote.status === 'Sent') {
      await base44.entities.Quote.update(quote.id, { status: 'Viewed' });
      quote.status = 'Viewed';
    }

    // Fetch related items
    const quoteItems = await base44.entities.QuoteItem.filter({ 
      quote_id: quote.id 
    });

    const quoteSections = await base44.entities.QuoteSection.filter({ 
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
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});