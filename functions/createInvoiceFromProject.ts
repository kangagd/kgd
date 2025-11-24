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

    const { project_id, lineItems, total } = await req.json();

    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    if (!lineItems || lineItems.length === 0) {
      return Response.json({ error: 'Line items are required' }, { status: 400 });
    }

    // Get project and related data
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    const settings = await base44.asServiceRole.entities.XeroSettings.list();
    if (settings.length === 0) {
      return Response.json({ error: 'Xero settings not configured' }, { status: 400 });
    }

    const xeroSettings = settings[0];
    const connection = await refreshAndGetConnection(base44);

    // Get associated jobs count
    const jobs = await base44.asServiceRole.entities.Job.filter({ project_id: project.id });

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
        Reference: `${project.title}${project.address ? ` - ${project.address}` : ''}`
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
      const error = await xeroResponse.text();
      throw new Error(`Xero API error: ${error}`);
    }

    const xeroResult = await xeroResponse.json();
    const xeroInvoice = xeroResult.Invoices[0];

    // Create XeroInvoice record
    const invoiceRecord = await base44.asServiceRole.entities.XeroInvoice.create({
      xero_invoice_id: xeroInvoice.InvoiceID,
      xero_invoice_number: xeroInvoice.InvoiceNumber,
      project_id: project.id,
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

    return Response.json({
      success: true,
      invoice: invoiceRecord,
      xero_invoice_number: xeroInvoice.InvoiceNumber
    });

  } catch (error) {
    console.error('Create invoice from project error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Failed to create invoice',
      details: error.stack 
    }, { status: 500 });
  }
});