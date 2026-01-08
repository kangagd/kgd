import { createClientFromRequest } from './shared/sdk.js';

// Batch sync all PandaDoc quote statuses
// Status mapping from PandaDoc to internal statuses
const mapPandaDocStatus = (pdStatus) => {
  const statusMap = {
    'document.draft': 'Draft',
    'document.sent': 'Sent',
    'document.viewed': 'Viewed',
    'document.completed': 'Approved',
    'document.voided': 'Voided',
    'document.declined': 'Declined',
    'document.waiting_approval': 'Pending Approval',
    'document.approved': 'Approved',
    'document.rejected': 'Declined',
    'document.waiting_pay': 'Awaiting Payment',
    'document.paid': 'Paid'
  };
  return statusMap[pdStatus] || 'Unknown';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const PANDADOC_API_KEY = Deno.env.get('PANDADOC_API_KEY');
    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    // Get all quotes with PandaDoc links
    const quotes = await base44.asServiceRole.entities.Quote.filter({
      pandadoc_document_id: { $ne: null }
    });

    console.log(`[batchSyncPandaDocStatuses] Starting sync for ${quotes.length} quotes`);

    const results = {
      total: quotes.length,
      synced: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const quote of quotes) {
      try {
        // Fetch document from PandaDoc
        const response = await fetch(
          `https://api.pandadoc.com/public/v1/documents/${quote.pandadoc_document_id}`,
          {
            headers: {
              'Authorization': `API-Key ${PANDADOC_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          results.failed++;
          results.errors.push({
            quote_id: quote.id,
            pandadoc_id: quote.pandadoc_document_id,
            error: `PandaDoc API error: ${response.status}`
          });
          continue;
        }

        const doc = await response.json();
        
        // Map status
        const newStatus = mapPandaDocStatus(doc.status);
        
        // Prepare update
        const updates = {
          status: newStatus,
          name: doc.name || quote.name
        };

        // Extract value if available
        if (doc.grand_total?.amount) {
          updates.total_value = parseFloat(doc.grand_total.amount);
        }

        // Add timestamps
        if (doc.date_created) {
          updates.created_at = new Date(doc.date_created).toISOString();
        }
        if (doc.date_sent) {
          updates.sent_at = new Date(doc.date_sent).toISOString();
        }
        if (doc.date_completed) {
          updates.approved_at = new Date(doc.date_completed).toISOString();
        }

        // Update quote
        await base44.asServiceRole.entities.Quote.update(quote.id, updates);
        results.synced++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          quote_id: quote.id,
          pandadoc_id: quote.pandadoc_document_id,
          error: error.message
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      summary: `Synced ${results.synced}/${results.total} quotes, ${results.failed} failed`,
      details: results
    });

  } catch (error) {
    console.error('batchSyncPandaDocStatuses error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});