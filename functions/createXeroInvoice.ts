import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

async function createXeroInvoice(base44, invoicePayload) {
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

  return {
    xero_invoice_id: invoice.InvoiceID,
    xero_invoice_number: invoice.InvoiceNumber,
    status: invoice.Status,
    total_amount: invoice.Total,
    amount_due: invoice.AmountDue,
    amount_paid: invoice.AmountPaid,
    pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoice.InvoiceID}`
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { invoicePayload } = await req.json();
    const result = await createXeroInvoice(base44, invoicePayload);

    return Response.json(result);

  } catch (error) {
    console.error('Create invoice error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export { createXeroInvoice };