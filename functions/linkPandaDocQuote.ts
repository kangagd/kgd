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

    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can link quotes' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { pandadocDocumentId, project_id, job_id, customerId } = body;

    if (!pandadocDocumentId) {
      return Response.json({ error: 'pandadocDocumentId is required' }, { status: 400 });
    }

    if (!project_id && !job_id) {
      return Response.json({ error: 'Either project_id or job_id is required' }, { status: 400 });
    }

    // GUARDRAIL: Check if already linked to THIS project - prevent duplicate links
    if (project_id) {
      const existingQuotes = await base44.asServiceRole.entities.Quote.filter({
        pandadoc_document_id: pandadocDocumentId,
        project_id: project_id
      });

      if (existingQuotes.length > 0) {
        return Response.json({ 
          error: 'This document is already linked to this project',
          existing_quote_id: existingQuotes[0].id
        }, { status: 400 });
      }
    }

    // Fetch document details from PandaDoc
    const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${pandadocDocumentId}`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    if (!docResponse.ok) {
      const errorText = await docResponse.text();
      console.error('PandaDoc fetch error:', errorText);
      return Response.json({ 
        error: 'Failed to fetch document from PandaDoc', 
        details: errorText,
        status: docResponse.status
      }, { status: 500 });
    }

    const pandadocDoc = await docResponse.json();

    // Fetch the public sharing link
    let publicUrl = '';
    try {
      // Only create session if document has recipients
      if (pandadocDoc.recipients && pandadocDoc.recipients.length > 0 && pandadocDoc.recipients[0].email) {
        const linksResponse = await fetch(`${PANDADOC_API_URL}/documents/${pandadocDocumentId}/session`, {
          method: 'POST',
          headers: {
            'Authorization': `API-Key ${PANDADOC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: pandadocDoc.recipients[0].email,
            lifetime: 31536000 // 1 year in seconds
          })
        });
        
        if (linksResponse.ok) {
          const linksData = await linksResponse.json();
          publicUrl = linksData.id ? `https://app.pandadoc.com/s/${linksData.id}` : '';
        } else {
          const errorText = await linksResponse.text();
          console.warn('Failed to create session link:', errorText);
        }
      } else {
        console.warn('No recipient email found, skipping session link creation');
      }
    } catch (linkError) {
      console.error('Failed to fetch public link:', linkError.message);
    }

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

    if (project_id) {
      const projects = await base44.entities.Project.filter({ id: project_id });
      if (projects[0]) {
        finalCustomerId = finalCustomerId || projects[0].customer_id;
        customerName = projects[0].customer_name || '';
        customerEmail = projects[0].customer_email || '';
        customerPhone = projects[0].customer_phone || '';
      }
    }

    if (job_id) {
      const jobs = await base44.entities.Job.filter({ id: job_id });
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
    let value = 0;
    if (pandadocDoc.grand_total?.amount) {
      const parsed = parseFloat(pandadocDoc.grand_total.amount);
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }

    // Create Quote record
    const quoteData = {
      project_id: project_id || null,
      job_id: job_id || null,
      customer_id: finalCustomerId,
      name: pandadocDoc.name || 'Untitled Quote',
      value: value,
      currency: pandadocDoc.grand_total?.currency || 'AUD',
      pandadoc_document_id: pandadocDoc.id,
      pandadoc_public_url: publicUrl || null,
      pandadoc_internal_url: `https://app.pandadoc.com/a/#/documents/${pandadocDoc.id}`,
      status: quoteStatus,
      sent_at: pandadocDoc.date_sent || null,
      viewed_at: null,
      accepted_at: quoteStatus === 'Accepted' ? new Date().toISOString() : null,
      expires_at: pandadocDoc.expiration_date || null,
      customer_name: customerName || '',
      customer_email: customerEmail || '',
      customer_phone: customerPhone || ''
    };

    console.log('Creating Quote with data:', JSON.stringify(quoteData, null, 2));
    const quote = await base44.asServiceRole.entities.Quote.create(quoteData);

    // Auto-populate project fields from quote if this is linked to a project
    if (project_id) {
      try {
        const project = await base44.asServiceRole.entities.Project.get(project_id);
        const updates = {};

        // GUARDRAIL: Set as primary quote ONLY if no primary quote exists
        if (!project.primary_quote_id) {
          updates.primary_quote_id = quote.id;
        }

        // GUARDRAIL: Set total_project_value ONLY if empty/zero - never override existing values
        if (value > 0 && (!project.total_project_value || project.total_project_value === 0)) {
          updates.total_project_value = value;
        }

        // Infer project_type if empty
        if (!project.project_type || project.project_type === '') {
          const quoteName = (pandadocDoc.name || '').toLowerCase();
          if (quoteName.includes('gate')) {
            updates.project_type = 'Gate Install';
          } else if (quoteName.includes('shutter') || quoteName.includes('roller')) {
            updates.project_type = 'Roller Shutter Install';
          } else if (quoteName.includes('repair')) {
            updates.project_type = 'Repair';
          } else if (quoteName.includes('door') || quoteName.includes('garage')) {
            updates.project_type = 'Garage Door Install';
          } else if (quoteName.includes('motor') || quoteName.includes('accessory')) {
            updates.project_type = 'Motor/Accessory';
          } else if (quoteName.includes('maintenance')) {
            updates.project_type = 'Maintenance';
          }
        }

        // Update project if we have any changes
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Project.update(project_id, updates);
        }
      } catch (error) {
        console.error('Failed to auto-populate project fields:', error);
        // Don't fail the whole operation if this fails
      }
    }

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