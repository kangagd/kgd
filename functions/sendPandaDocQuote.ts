import { createClientFromRequest } from './shared/sdk.js';
import { updateProjectActivity } from './updateProjectActivity.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

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
      return Response.json({ error: 'Only admins can send quotes' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { quoteId, message, subject } = body;

    if (!quoteId) {
      return Response.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Get the quote
    const quotes = await base44.entities.Quote.filter({ id: quoteId });
    const quote = quotes[0];

    if (!quote) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (!quote.pandadoc_document_id) {
      return Response.json({ error: 'Quote has no PandaDoc document' }, { status: 400 });
    }

    // Check document status in PandaDoc (must be in draft status to send)
    const statusResponse = await fetch(
      `${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}`,
      {
        headers: {
          'Authorization': `API-Key ${PANDADOC_API_KEY}`
        }
      }
    );

    if (!statusResponse.ok) {
      return Response.json({ error: 'Failed to check PandaDoc document status' }, { status: 500 });
    }

    const docStatus = await statusResponse.json();

    // If document is still processing, wait or return error
    if (docStatus.status === 'document.uploaded') {
      return Response.json({ 
        error: 'Document is still processing. Please try again in a few seconds.',
        pandadoc_status: docStatus.status
      }, { status: 400 });
    }

    // Send the document
    const sendPayload = {
      message: message || `Please review and sign the quote for ${quote.name}`,
      subject: subject || `Quote: ${quote.name}`,
      silent: false
    };

    const sendResponse = await fetch(
      `${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `API-Key ${PANDADOC_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendPayload)
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('PandaDoc send error:', errorText);
      return Response.json({ 
        error: 'Failed to send PandaDoc document', 
        details: errorText 
      }, { status: sendResponse.status });
    }

    const sendResult = await sendResponse.json();

    // Get the sharing link
    const linkResponse = await fetch(
      `${PANDADOC_API_URL}/documents/${quote.pandadoc_document_id}/session`,
      {
        method: 'POST',
        headers: {
          'Authorization': `API-Key ${PANDADOC_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: quote.customer_email,
          lifetime: 86400 * 30 // 30 days
        })
      }
    );

    let publicUrl = '';
    if (linkResponse.ok) {
      const linkResult = await linkResponse.json();
      publicUrl = linkResult.id ? `https://app.pandadoc.com/s/${linkResult.id}` : '';
    }

    // Update our Quote record
    await base44.entities.Quote.update(quote.id, {
      status: 'Sent',
      sent_at: new Date().toISOString(),
      pandadoc_public_url: publicUrl || quote.pandadoc_public_url
    });

    // Update project activity if quote is linked to a project
    if (quote.project_id) {
      await updateProjectActivity(base44, quote.project_id, 'Quote Sent');
    }

    return Response.json({
      success: true,
      message: 'Quote sent successfully',
      public_url: publicUrl
    });

  } catch (error) {
    console.error('sendPandaDocQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});