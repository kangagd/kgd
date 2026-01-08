import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
const PANDADOC_API_URL = "https://api.pandadoc.com/public/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { quoteId } = body;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Fetch the quote from database
    const quotes = await base44.entities.Quote.filter({ id: quoteId });
    const quote = quotes[0];

    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (!quote.pandadoc_document_id) {
      return Response.json({ error: 'Quote is not linked to a PandaDoc document' }, { status: 400 });
    }

    // Fetch document details from PandaDoc
    const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    if (!docResponse.ok) {
      const errorText = await docResponse.text();
      console.error('PandaDoc fetch error:', errorText);
      return Response.json({ error: 'Failed to fetch document from PandaDoc', details: errorText }, { status: 500 });
    }

    const pandadocDoc = await docResponse.json();

    // Map PandaDoc status to our status
    const statusMap = {
      'document.draft': 'Draft',
      'document.uploaded': 'Draft',
      'document.sent': 'Sent',
      'document.viewed': 'Viewed',
      'document.waiting_approval': 'Sent',
      'document.approved': 'Accepted',
      'document.rejected': 'Declined',
      'document.completed': 'Accepted',
      'document.voided': 'Declined',
      'document.declined': 'Declined',
      'document.expired': 'Expired'
    };

    const newStatus = statusMap[pandadocDoc.status] || quote.status;

    // Build update object
    const updateData = {
      status: newStatus,
      name: pandadocDoc.name || quote.name
    };

    // Update value if available
    if (pandadocDoc.grand_total?.amount) {
      const newValue = parseFloat(pandadocDoc.grand_total.amount);
      if (!isNaN(newValue)) {
        updateData.value = newValue;
      }
    }

    // Update timestamps based on status
    if (pandadocDoc.date_sent && !quote.sent_at) {
      updateData.sent_at = pandadocDoc.date_sent;
    }

    if (newStatus === 'Viewed' && !quote.viewed_at) {
      updateData.viewed_at = new Date().toISOString();
    }

    if (newStatus === 'Accepted' && !quote.accepted_at) {
      updateData.accepted_at = new Date().toISOString();
    }

    if (newStatus === 'Declined' && !quote.declined_at) {
      updateData.declined_at = new Date().toISOString();
    }

    // Reset expiration date when document is re-opened (moved back to Draft or Sent)
    if (pandadocDoc.expiration_date) {
      updateData.expires_at = pandadocDoc.expiration_date;
    } else if ((newStatus === 'Draft' || newStatus === 'Sent') && (quote.status === 'Expired' || quote.status === 'Declined')) {
      // If PandaDoc doesn't provide expiration_date but we're re-opening, calculate new expiration
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      updateData.expires_at = thirtyDaysFromNow.toISOString();
    }

    // Update the quote
    await base44.entities.Quote.update(quoteId, updateData);

    return Response.json({
      success: true,
      previous_status: quote.status,
      new_status: newStatus,
      pandadoc_status: pandadocDoc.status,
      updated_fields: Object.keys(updateData)
    });

  } catch (error) {
    console.error('refreshQuoteFromPandaDoc error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});