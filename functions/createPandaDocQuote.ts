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

    // Only admins can create quotes
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can create quotes' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { project_id, job_id } = normalizeParams(body);
    const { templateId, quoteName, validDays = 30, lineItems = [], notes } = body;

    if (!project_id && !job_id) {
      return Response.json({ error: 'Either project_id/projectId or job_id/jobId is required' }, { status: 400 });
    }

    if (!templateId) {
      return Response.json({ error: 'templateId is required' }, { status: 400 });
    }

    // Load Project or Job
    let project = null;
    let job = null;
    let customer = null;
    let address = '';

    if (project_id) {
      const projects = await base44.entities.Project.filter({ id: project_id });
      project = projects[0];
      if (!project) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }
      address = project.address_full || '';
    }

    if (job_id) {
      const jobs = await base44.entities.Job.filter({ id: job_id });
      job = jobs[0];
      if (!job) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      address = job.address_full || address;
    }

    // Get customer
    const customerId = project?.customer_id || job?.customer_id;
    if (!customerId) {
      return Response.json({ error: 'No customer associated with project/job' }, { status: 400 });
    }

    const customers = await base44.entities.Customer.filter({ id: customerId });
    customer = customers[0];
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Calculate total value from line items (including 10% tax to match PandaDoc pricing table)
    const totalValue = lineItems.reduce((sum, item) => {
      return sum + (item.quantity || 1) * (item.price || 0);
    }, 0) * 1.1;

    // Build quote name
    const finalQuoteName = quoteName || 
      `${project?.title || `Job #${job?.job_number}`} – ${customer.name}`;

    // Prepare PandaDoc tokens (merge fields)
    const tokens = [
      { name: "customer_name", value: customer.name || '' },
      { name: "customer_email", value: customer.email || '' },
      { name: "customer_phone", value: customer.phone || '' },
      { name: "address", value: address },
      { name: "project_title", value: project?.title || '' },
      { name: "project_description", value: project?.description || '' },
      { name: "job_number", value: job?.job_number?.toString() || '' },
      { name: "job_type", value: job?.job_type_name || job?.job_type || '' },
      { name: "job_notes", value: job?.notes || '' },
      { name: "total_value", value: totalValue.toFixed(2) },
      { name: "quote_date", value: new Date().toLocaleDateString('en-AU') },
      { name: "valid_until", value: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU') }
    ];

    // Prepare pricing table items for PandaDoc
    const pricingItems = lineItems.map(item => ({
      name: item.name || item.label || 'Item',
      description: item.description || '',
      price: item.price || 0,
      qty: item.quantity || 1,
      tax_first: {
        value: 10,
        type: "percent"
      }
    }));

    // Fetch template details to determine correct role
    let recipientRole = "Client";
    try {
      const detailsRes = await fetch(`${PANDADOC_API_URL}/templates/${templateId}/details`, {
        headers: { 'Authorization': `API-Key ${PANDADOC_API_KEY}` }
      });
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        if (details.roles && details.roles.length > 0) {
          // Try to find common role names
          const names = details.roles.map(r => r.name);
          const preferred = ['Client', 'Customer', 'Signer', 'Recipient'];
          recipientRole = preferred.find(p => names.includes(p)) || names[0];
        } else {
          recipientRole = null; // No roles defined in template
        }
      }
    } catch (e) {
      console.error("Failed to fetch template roles:", e);
    }

    const recipient = {
      email: customer.email,
      first_name: customer.name?.split(' ')[0] || '',
      last_name: customer.name?.split(' ').slice(1).join(' ') || ''
    };
    if (recipientRole) recipient.role = recipientRole;

    // Create document from template in PandaDoc
    const createDocPayload = {
      name: finalQuoteName,
      template_uuid: templateId,
      recipients: [recipient],
      tokens: tokens,
      metadata: {
        project_id: project_id || '',
        job_id: job_id || '',
        customer_id: customerId
      }
    };

    // Add pricing table if we have line items
    // Try with pricing table first, fall back to tokens-only if template doesn't support it
    if (pricingItems.length > 0) {
      createDocPayload.pricing_tables = [
        {
          name: "PricingTable1",
          options: {
            currency: "AUD",
            discount: { type: "absolute", value: 0 }
          },
          sections: [
            {
              title: "Products & Services",
              default: true,
              rows: pricingItems
            }
          ]
        }
      ];
    }

    // Call PandaDoc API to create document
    let createResponse = await fetch(`${PANDADOC_API_URL}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createDocPayload)
    });

    // If pricing table fails due to data merge not enabled, retry without it
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      
      if (errorText.includes('Data merge is disabled') && createDocPayload.pricing_tables) {
        console.warn('Template does not support pricing table data merge, retrying without pricing_tables');
        delete createDocPayload.pricing_tables;
        
        createResponse = await fetch(`${PANDADOC_API_URL}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `API-Key ${PANDADOC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createDocPayload)
        });
        
        if (!createResponse.ok) {
          const retryErrorText = await createResponse.text();
          console.error('PandaDoc create error (retry):', retryErrorText);
          return Response.json({ 
            error: 'Failed to create PandaDoc document', 
            details: retryErrorText 
          }, { status: createResponse.status });
        }
      } else {
        console.error('PandaDoc create error:', errorText);
        return Response.json({ 
          error: 'Failed to create PandaDoc document', 
          details: errorText 
        }, { status: createResponse.status });
      }
    }

    const pandadocDoc = await createResponse.json();

    // Calculate expiry date
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

    // Create Quote record in our database
    const quote = await base44.entities.Quote.create({
      project_id: project_id || null,
      job_id: job_id || null,
      customer_id: customerId,
      name: finalQuoteName,
      value: totalValue,
      currency: 'AUD',
      pandadoc_document_id: pandadocDoc.id,
      pandadoc_public_url: '', // Will be set when document is sent
      pandadoc_internal_url: `https://app.pandadoc.com/a/#/documents/${pandadocDoc.id}`,
      status: 'Draft',
      expires_at: expiresAt,
      notes_internal: notes || '',
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      project_title: project?.title || '',
      job_number: job?.job_number || null,
      address_full: address
    });

    // Update project activity if quote is linked to a project
    if (project_id) {
      await updateProjectActivity(base44, project_id, 'Quote Created');
    }

    return Response.json({
      success: true,
      quote: quote,
      pandadoc_id: pandadocDoc.id,
      pandadoc_status: pandadocDoc.status
    });

  } catch (error) {
    console.error('createPandaDocQuote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});