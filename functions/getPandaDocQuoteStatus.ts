import { createClientFromRequest } from './shared/sdk.js';

const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
const PANDADOC_API_URL = "https://api.pandadoc.com/public/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quoteId } = body;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Get the quote
    const quotes = await base44.entities.Quote.filter({ id: quoteId });
    const quote = quotes[0];

    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Technicians can only see accepted quotes
    if (user.role !== 'admin' && quote.status !== 'Accepted') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!quote.pandadoc_document_id) {
      return Response.json({ 
        success: true,
        quote: quote,
        pandadoc_status: null
      });
    }

    // Fetch current status from PandaDoc
    const response = await fetch(
      `${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}`,
      {
        headers: {
          'Authorization': `API-Key ${PANDADOC_API_KEY}`
        }
      }
    );

    let pandadocStatus = null;
    let pandadocDetails = null;

    if (response.ok) {
      pandadocDetails = await response.json();
      pandadocStatus = pandadocDetails.status;

      // Sync status if needed
      const statusMap = {
        'document.draft': 'Draft',
        'document.sent': 'Sent',
        'document.viewed': 'Viewed',
        'document.completed': 'Accepted',
        'document.voided': 'Declined',
        'document.declined': 'Declined'
      };

      const mappedStatus = statusMap[pandadocStatus];
      const updates = {};

      if (mappedStatus && mappedStatus !== quote.status) {
        updates.status = mappedStatus;
        quote.status = mappedStatus;
      }

      // Update value if available from PandaDoc
      let grandTotal = pandadocDetails.grand_total?.amount;

      // Fallback: fetch details if grand_total is missing or zero
      if (!grandTotal || parseFloat(grandTotal) === 0) {
        try {
          const detailsResponse = await fetch(
            `${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}/details`,
            {
              headers: { 'Authorization': `API-Key ${PANDADOC_API_KEY}` }
            }
          );
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            // Try to get total from details (pricing tables)
            if (details.grand_total?.amount) {
              grandTotal = details.grand_total.amount;
            } else if (details.pricing_tables) {
              // Sum up all pricing tables
              let sum = 0;
              details.pricing_tables.forEach(pt => {
                if (pt.total) sum += parseFloat(pt.total) || 0;
              });
              if (sum > 0) grandTotal = sum;
            }
          }
        } catch (e) {
          console.error('Failed to fetch document details:', e);
        }
      }

      if (grandTotal) {
        const newValue = parseFloat(grandTotal);
        if (!isNaN(newValue) && newValue !== quote.value) {
          updates.value = newValue;
          quote.value = newValue;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.entities.Quote.update(quote.id, updates);
      }
    }

    return Response.json({
      success: true,
      quote: quote,
      pandadoc_status: pandadocStatus,
      pandadoc_details: user.role === 'admin' ? pandadocDetails : null
    });

  } catch (error) {
    console.error('getPandaDocQuoteStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});