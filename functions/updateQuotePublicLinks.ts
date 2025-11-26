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
      return Response.json({ error: 'Only admins can run this' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    // Fetch all quotes with pandadoc_document_id but no public URL
    const quotes = await base44.entities.Quote.filter({
      pandadoc_document_id: { $exists: true }
    });

    const quotesToUpdate = quotes.filter(q => 
      q.pandadoc_document_id && (!q.pandadoc_public_url || q.pandadoc_public_url === '')
    );

    const results = [];

    for (const quote of quotesToUpdate) {
      try {
        // Fetch document details to get recipients
        const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}`, {
          headers: {
            'Authorization': `API-Key ${PANDADOC_API_KEY}`
          }
        });

        if (!docResponse.ok) {
          results.push({ quote_id: quote.id, success: false, error: 'Failed to fetch document' });
          continue;
        }

        const pandadocDoc = await docResponse.json();

        // Get public link via session
        const linksResponse = await fetch(`${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}/session`, {
          method: 'POST',
          headers: {
            'Authorization': `API-Key ${PANDADOC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: pandadocDoc.recipients?.[0]?.email || quote.customer_email || '',
            lifetime: 31536000 // 1 year
          })
        });

        if (linksResponse.ok) {
          const linksData = await linksResponse.json();
          const publicUrl = linksData.id ? `https://app.pandadoc.com/s/${linksData.id}` : '';

          if (publicUrl) {
            await base44.entities.Quote.update(quote.id, {
              pandadoc_public_url: publicUrl
            });
            results.push({ quote_id: quote.id, name: quote.name, success: true, public_url: publicUrl });
          } else {
            results.push({ quote_id: quote.id, success: false, error: 'No session ID returned' });
          }
        } else {
          const errorText = await linksResponse.text();
          results.push({ quote_id: quote.id, success: false, error: errorText });
        }
      } catch (err) {
        results.push({ quote_id: quote.id, success: false, error: err.message });
      }
    }

    return Response.json({
      success: true,
      total_quotes: quotes.length,
      quotes_updated: results.filter(r => r.success).length,
      results
    });

  } catch (error) {
    console.error('updateQuotePublicLinks error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});