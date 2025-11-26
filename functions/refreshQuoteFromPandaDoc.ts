import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
const PANDADOC_API_URL = "https://api.pandadoc.com/public/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can refresh quotes' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { quoteId } = body;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Fetch the quote
    const quotes = await base44.entities.Quote.filter({ id: quoteId });
    const quote = quotes[0];

    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (!quote.pandadoc_document_id) {
      return Response.json({ error: 'Quote has no PandaDoc document linked' }, { status: 400 });
    }

    // Fetch document details from PandaDoc
    const detailsResponse = await fetch(`${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}/details`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    if (!detailsResponse.ok) {
      return Response.json({ error: 'Failed to fetch document details from PandaDoc' }, { status: 500 });
    }

    const detailsData = await detailsResponse.json();

    // Extract line items from pricing tables
    let lineItems = [];
    let totalValue = 0;

    if (detailsData.pricing_tables && detailsData.pricing_tables.length > 0) {
      for (const table of detailsData.pricing_tables) {
        if (table.sections) {
          for (const section of table.sections) {
            if (section.rows) {
              for (const row of section.rows) {
                const qty = row.data?.qty || row.qty || 1;
                const price = row.data?.price || row.price || 0;
                lineItems.push({
                  name: row.data?.name || row.name || 'Item',
                  description: row.data?.description || row.description || '',
                  quantity: qty,
                  price: price
                });
                totalValue += qty * price;
              }
            }
          }
        }
      }
    }

    // Also fetch the main document for grand total
    const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    let grandTotal = totalValue;
    if (docResponse.ok) {
      const docData = await docResponse.json();
      if (docData.grand_total?.amount) {
        grandTotal = docData.grand_total.amount;
      }
    }

    // Update the quote with line items
    await base44.entities.Quote.update(quoteId, {
      line_items: lineItems,
      value: grandTotal
    });

    // Fetch updated quote
    const updatedQuotes = await base44.entities.Quote.filter({ id: quoteId });

    return Response.json({
      success: true,
      quote: updatedQuotes[0],
      line_items_count: lineItems.length
    });

  } catch (error) {
    console.error('refreshQuoteFromPandaDoc error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});