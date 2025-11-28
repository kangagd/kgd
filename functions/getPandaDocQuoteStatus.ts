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
      if (pandadocDetails.grand_total?.amount) {
        const newValue = parseFloat(pandadocDetails.grand_total.amount);
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