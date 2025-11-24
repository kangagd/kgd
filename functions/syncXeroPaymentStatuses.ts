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
    
    // This function can be called via cron without user auth
    const connection = await refreshAndGetConnection(base44);

    // Get all unpaid/partially paid invoices
    const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({
      status: { $in: ['Authorised', 'Submitted'] }
    });

    const updates = [];
    const errors = [];

    for (const invoice of invoices) {
      try {
        // Fetch latest invoice data from Xero
        const response = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices/${invoice.xero_invoice_id}`,
          {
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
              'xero-tenant-id': connection.xero_tenant_id,
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          errors.push({ invoice_id: invoice.id, error: 'Failed to fetch from Xero' });
          continue;
        }

        const result = await response.json();
        const xeroInvoice = result.Invoices[0];

        // Check if status changed
        if (xeroInvoice.Status !== invoice.status || 
            xeroInvoice.AmountDue !== invoice.amount_due ||
            xeroInvoice.AmountPaid !== invoice.amount_paid) {
          
          await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
            status: xeroInvoice.Status,
            amount_due: xeroInvoice.AmountDue,
            amount_paid: xeroInvoice.AmountPaid || 0,
            last_payment_date: xeroInvoice.Payments?.[0]?.Date || invoice.last_payment_date,
            raw_payload: xeroInvoice
          });

          updates.push({
            invoice_id: invoice.id,
            invoice_number: invoice.xero_invoice_number,
            old_status: invoice.status,
            new_status: xeroInvoice.Status,
            amount_due: xeroInvoice.AmountDue,
            amount_paid: xeroInvoice.AmountPaid
          });
        }
      } catch (err) {
        errors.push({ 
          invoice_id: invoice.id, 
          error: err.message 
        });
      }
    }

    return Response.json({
      success: true,
      synced_count: updates.length,
      total_checked: invoices.length,
      updates,
      errors
    });

  } catch (error) {
    console.error('Sync payment statuses error:', error);
    return Response.json({ 
      error: error.message || 'Failed to sync payment statuses',
      details: error.stack
    }, { status: 500 });
  }
});