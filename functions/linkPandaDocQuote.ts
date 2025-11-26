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
      return Response.json({ error: 'Only admins can link quotes' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { pandadocDocumentId, projectId, jobId, customerId } = body;

    if (!pandadocDocumentId) {
      return Response.json({ error: 'pandadocDocumentId is required' }, { status: 400 });
    }

    if (!projectId && !jobId) {
      return Response.json({ error: 'Either projectId or jobId is required' }, { status: 400 });
    }

    // Check if already linked
    const existingQuotes = await base44.entities.Quote.filter({
      pandadoc_document_id: pandadocDocumentId
    });

    if (existingQuotes.length > 0) {
      return Response.json({ 
        error: 'This document is already linked to another quote',
        existing_quote_id: existingQuotes[0].id
      }, { status: 400 });
    }

    // Fetch document details from PandaDoc
    const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${pandadocDocumentId}`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    if (!docResponse.ok) {
      return Response.json({ error: 'Failed to fetch document from PandaDoc' }, { status: 500 });
    }

    const pandadocDoc = await docResponse.json();

    // Map PandaDoc status to our status
    const statusMap = {
      'document.draft': 'Draft',
      'document.uploaded': 'Draft',
      'document.sent': 'Sent',
      'document.viewed': 'Viewed',
      'document.waiting_approval': 'Sent',
      'document.completed': 'Accepted',
      'document.voided': 'Declined',
      'document.declined': 'Declined',
      'document.expired': 'Expired'
    };

    const quoteStatus = statusMap[pandadocDoc.status] || 'Draft';

    // Get customer info if not provided
    let finalCustomerId = customerId;
    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';

    if (projectId) {
      const projects = await base44.entities.Project.filter({ id: projectId });
      if (projects[0]) {
        finalCustomerId = finalCustomerId || projects[0].customer_id;
        customerName = projects[0].customer_name || '';
        customerEmail = projects[0].customer_email || '';
        customerPhone = projects[0].customer_phone || '';
      }
    }

    if (jobId) {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      if (jobs[0]) {
        finalCustomerId = finalCustomerId || jobs[0].customer_id;
        customerName = customerName || jobs[0].customer_name || '';
        customerEmail = customerEmail || jobs[0].customer_email || '';
        customerPhone = customerPhone || jobs[0].customer_phone || '';
      }
    }

    if (!finalCustomerId) {
      return Response.json({ error: 'Could not determine customer' }, { status: 400 });
    }

    // Extract value from PandaDoc
    const value = pandadocDoc.grand_total?.amount || 0;

    // Create Quote record
    const quote = await base44.entities.Quote.create({
      project_id: projectId || null,
      job_id: jobId || null,
      customer_id: finalCustomerId,
      name: pandadocDoc.name,
      value: value,
      currency: pandadocDoc.grand_total?.currency || 'AUD',
      pandadoc_document_id: pandadocDoc.id,
      pandadoc_public_url: '',
      pandadoc_internal_url: `https://app.pandadoc.com/a/#/documents/${pandadocDoc.id}`,
      status: quoteStatus,
      sent_at: pandadocDoc.date_sent || null,
      viewed_at: null,
      accepted_at: quoteStatus === 'Accepted' ? new Date().toISOString() : null,
      expires_at: pandadocDoc.expiration_date || null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone
    });

    return Response.json({
      success: true,
      quote: quote,
      pandadoc_status: pandadocDoc.status
    });

  } catch (error) {
    console.error('linkPandaDocQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});