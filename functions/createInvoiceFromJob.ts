import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshAndGetConnection(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  if (connections.length === 0) throw new Error('No Xero connection found');
  
  const connection = connections[0];
  const expiresAt = new Date(connection.expires_at);
  
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token
      })
    });

    if (!tokenResponse.ok) throw new Error('Token refresh failed');
    
    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    });

    return { ...connection, access_token: tokens.access_token };
  }

  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { job_id, lineItems, total } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    if (!lineItems || lineItems.length === 0) {
      return Response.json({ error: 'Line items are required' }, { status: 400 });
    }

    // Get job and related data
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    const customer = await base44.asServiceRole.entities.Customer.get(job.customer_id);
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    const settings = await base44.asServiceRole.entities.XeroSettings.list();
    if (settings.length === 0) {
      return Response.json({ error: 'Xero settings not configured' }, { status: 400 });
    }

    const xeroSettings = settings[0];
    const connection = await refreshAndGetConnection(base44);

    // Find available invoice number (handle duplicates with .1, .2, etc.)
    let invoiceNumber = String(job.job_number);
    let suffix = 0;
    let numberAvailable = false;
    
    while (!numberAvailable) {
      const checkNumber = suffix === 0 ? invoiceNumber : `${invoiceNumber}.${suffix}`;
      
      // Check if invoice number exists in Xero
      const checkResponse = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber="${checkNumber}"`,
        {
          headers: {
            'Authorization': `Bearer ${connection.access_token}`,
            'xero-tenant-id': connection.xero_tenant_id,
            'Accept': 'application/json'
          }
        }
      );
      
      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        if (checkResult.Invoices && checkResult.Invoices.length > 0) {
          // Number exists, try next suffix
          suffix++;
        } else {
          // Number available
          invoiceNumber = checkNumber;
          numberAvailable = true;
        }
      } else {
        // If check fails, use the number anyway
        invoiceNumber = checkNumber;
        numberAvailable = true;
      }
      
      // Safety limit to prevent infinite loop
      if (suffix > 50) {
        throw new Error('Could not find available invoice number');
      }
    }

    // Prepare invoice payload
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + (xeroSettings.payment_terms_days || 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Convert line items to Xero format (with discounts handled as separate line items)
    const xeroLineItems = [];
    lineItems.forEach((item) => {
      // Add main line item
      xeroLineItems.push({
        Description: item.description,
        Quantity: 1,
        UnitAmount: item.amount,
        AccountCode: xeroSettings.default_account_code,
        TaxType: xeroSettings.default_tax_type
      });

      // Add discount as a separate negative line item if applicable
      if (item.discount && item.discount > 0) {
        xeroLineItems.push({
          Description: `Discount - ${item.description}`,
          Quantity: 1,
          UnitAmount: -item.discount,
          AccountCode: xeroSettings.default_account_code,
          TaxType: xeroSettings.default_tax_type
        });
      }
    });

    const invoicePayload = {
      Invoices: [{
        Type: 'ACCREC',
        Contact: {
          Name: customer.name,
          EmailAddress: customer.email || ''
        },
        Date: today,
        DueDate: dueDate,
        LineItems: xeroLineItems,
        Status: 'AUTHORISED',
        InvoiceNumber: invoiceNumber,
        Reference: `Job #${job.job_number}${job.address ? ` - ${job.address}` : ''}`
      }]
    };

    // Create invoice in Xero
    const xeroResponse = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'xero-tenant-id': connection.xero_tenant_id,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!xeroResponse.ok) {
      const errorText = await xeroResponse.text();
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.Elements && errorJson.Elements[0]?.ValidationErrors) {
          const validationErrors = errorJson.Elements[0].ValidationErrors;
          const errorMessages = validationErrors.map(e => e.Message).join('; ');
          errorDetails = `Xero validation failed: ${errorMessages}. Please check your Xero Settings - the Tax Type (${xeroSettings.default_tax_type}) may not be compatible with Account Code (${xeroSettings.default_account_code}). Go to Xero → Settings → Tax Rates to find the correct tax code.`;
        }
      } catch (e) {
        // Keep original error text if parsing fails
      }
      throw new Error(errorDetails);
    }

    const xeroResult = await xeroResponse.json();
    const xeroInvoice = xeroResult.Invoices[0];

    // Create XeroInvoice record
    const invoiceRecord = await base44.asServiceRole.entities.XeroInvoice.create({
      xero_invoice_id: xeroInvoice.InvoiceID,
      xero_invoice_number: xeroInvoice.InvoiceNumber,
      job_id: job.id,
      project_id: job.project_id || null,
      customer_id: customer.id,
      customer_name: customer.name,
      status: xeroInvoice.Status,
      total_amount: xeroInvoice.Total,
      amount_due: xeroInvoice.AmountDue,
      amount_paid: xeroInvoice.AmountPaid || 0,
      issue_date: today,
      due_date: dueDate,
      pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${xeroInvoice.InvoiceID}`,
      raw_payload: xeroInvoice,
      created_by_user_id: user.id
    });

    // Link invoice to job
    await base44.asServiceRole.entities.Job.update(job.id, {
      xero_invoice_id: invoiceRecord.id
    });

    return Response.json({
      success: true,
      invoice: invoiceRecord,
      xero_invoice_number: xeroInvoice.InvoiceNumber
    });

  } catch (error) {
    console.error('Create invoice from job error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Failed to create invoice',
      details: error.stack 
    }, { status: 500 });
  }
});