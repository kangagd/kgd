import { createClientFromRequest } from './shared/sdk.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

async function refreshXeroTokenIfNeeded(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  
  if (connections.length === 0) {
    throw new Error('No Xero connection found');
  }

  const connection = connections[0];
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
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

    if (!tokenResponse.ok) {
      throw new Error('Token refresh failed');
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    });

    return {
      ...connection,
      access_token: tokens.access_token
    };
  }

  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admin and manager roles
    const isAuthorized = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden - Admin or Manager access required' }, { status: 403 });
    }

    const body = await req.json();
    const { project_id } = normalizeParams(body);
    const { lineItems, total } = body;

    // Fetch project
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch customer
    const customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get Xero settings for account codes - default to 200 (Sales)
    const xeroSettings = await base44.asServiceRole.entities.XeroSettings.list();
    const accountCode = (xeroSettings.length > 0 && xeroSettings[0].default_sales_account_code) 
      ? xeroSettings[0].default_sales_account_code 
      : "200";

    // Build Xero invoice payload
    const xeroLineItems = lineItems.map(item => ({
      Description: item.description,
      Quantity: item.quantity || 1,
      UnitAmount: item.amount,
      AccountCode: accountCode,
      TaxType: "OUTPUT", // GST on Output (10%)
      DiscountAmount: item.discount || 0
    }));

    const invoicePayload = {
      Type: "ACCREC",
      Contact: {
        Name: customer.name,
        EmailAddress: customer.email || "",
        Phones: customer.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: customer.phone }] : []
      },
      Date: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      LineItems: xeroLineItems,
      InvoiceNumber: String(project.project_number),
      Reference: project.address_full || project.address || `Project #${project.project_number}`,
      Status: "AUTHORISED"
    };

    // Create invoice in Xero
    const connection = await refreshXeroTokenIfNeeded(base44);

    const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'xero-tenant-id': connection.xero_tenant_id,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xero API error: ${error}`);
    }

    const result = await response.json();
    const invoice = result.Invoices[0];

    // Create XeroInvoice record in database
    const xeroInvoice = await base44.asServiceRole.entities.XeroInvoice.create({
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      project_id: project.id,
      customer_id: project.customer_id,
      customer_name: customer.name,
      contact_name: customer.name,
      status: invoice.Status,
      total: invoice.Total,
      total_amount: invoice.Total,
      amount_due: invoice.AmountDue,
      amount_paid: invoice.AmountPaid,
      date: invoice.Date,
      due_date: invoice.DueDate,
      issue_date: invoice.Date,
      pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoice.InvoiceID}`,
      online_payment_url: invoice.OnlineInvoiceUrl || null,
      reference: `Project #${project.project_number} - ${project.title}`,
      raw_payload: invoice
    });

    // Update project activity
    try {
      await base44.asServiceRole.entities.Project.update(project.id, {
        last_activity_at: new Date().toISOString(),
        last_activity_type: 'Invoice Created'
      });
    } catch (e) {
      console.error('Failed to update project activity:', e);
    }

    return Response.json({ 
      success: true, 
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      total: invoice.Total,
      pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoice.InvoiceID}`
    });

  } catch (error) {
    console.error('Create invoice from project error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});