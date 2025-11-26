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
      const errorText = await detailsResponse.text();
      console.error('PandaDoc API error:', errorText);
      return Response.json({ error: 'Failed to fetch document details from PandaDoc' }, { status: 500 });
    }

    const detailsData = await detailsResponse.json();

    // Log the structure for debugging
    console.log('PandaDoc details structure:', JSON.stringify(detailsData, null, 2));

    // Extract line items from pricing tables
    let lineItems = [];
    let totalValue = 0;

    if (detailsData.pricing_tables && detailsData.pricing_tables.length > 0) {
      for (const table of detailsData.pricing_tables) {
        // Try sections first (newer API structure)
        if (table.sections) {
          for (const section of table.sections) {
            if (section.rows) {
              for (const row of section.rows) {
                const data = row.data || row;
                const qty = data.qty || data.QTY || data.quantity || 1;
                const price = data.price || data.Price || data.cost || 0;
                const name = data.name || data.Name || data.sku || 'Item';
                const description = data.description || data.Description || '';
                
                lineItems.push({
                  name: name,
                  description: description,
                  quantity: parseFloat(qty) || 1,
                  price: parseFloat(price) || 0
                });
                totalValue += (parseFloat(qty) || 1) * (parseFloat(price) || 0);
              }
            }
          }
        }
        
        // Also try items directly on table (older API structure)
        if (table.items && table.items.length > 0) {
          for (const item of table.items) {
            const qty = item.qty || item.quantity || 1;
            const price = item.price || item.cost || 0;
            const name = item.name || item.sku || item.title || 'Item';
            const description = item.description || '';
            
            lineItems.push({
              name: name,
              description: description,
              quantity: parseFloat(qty) || 1,
              price: parseFloat(price) || 0
            });
            totalValue += (parseFloat(qty) || 1) * (parseFloat(price) || 0);
          }
        }

        // Try rows directly on table
        if (table.rows && table.rows.length > 0) {
          for (const row of table.rows) {
            const data = row.data || row;
            const qty = data.qty || data.QTY || data.quantity || 1;
            const price = data.price || data.Price || data.cost || 0;
            const name = data.name || data.Name || data.sku || 'Item';
            const description = data.description || data.Description || '';
            
            lineItems.push({
              name: name,
              description: description,
              quantity: parseFloat(qty) || 1,
              price: parseFloat(price) || 0
            });
            totalValue += (parseFloat(qty) || 1) * (parseFloat(price) || 0);
          }
        }
      }
    }

    // Check for pricing field directly on the document
    if (lineItems.length === 0 && detailsData.pricing) {
      const pricing = detailsData.pricing;
      if (Array.isArray(pricing)) {
        for (const item of pricing) {
          lineItems.push({
            name: item.name || item.title || 'Item',
            description: item.description || '',
            quantity: parseFloat(item.qty || item.quantity || 1),
            price: parseFloat(item.price || item.cost || 0)
          });
        }
      }
    }

    console.log('Extracted line items:', lineItems.length, lineItems);

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
      line_items_count: lineItems.length,
      debug: {
        has_pricing_tables: !!detailsData.pricing_tables,
        pricing_tables_count: detailsData.pricing_tables?.length || 0
      }
    });

  } catch (error) {
    console.error('refreshQuoteFromPandaDoc error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});