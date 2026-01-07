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

// This function runs periodically to sync invoice statuses from Xero
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all active invoices (not paid or voided)
    const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({
      status: { $in: ['AUTHORISED', 'SUBMITTED', 'OVERDUE', 'DRAFT'] }
    });

    if (invoices.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No invoices to sync',
        synced: 0 
      });
    }

    const connection = await refreshAndGetConnection(base44);
    const updated = [];
    const errors = [];

    // Sync each invoice
    for (const invoice of invoices) {
      try {
        // Fetch latest data from Xero
        const xeroResponse = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices/${invoice.xero_invoice_id}`,
          {
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
              'xero-tenant-id': connection.xero_tenant_id,
              'Accept': 'application/json'
            }
          }
        );

        if (!xeroResponse.ok) continue;

        const xeroResult = await xeroResponse.json();
        const xeroInvoice = xeroResult.Invoices[0];

        // Check if status or amounts have changed
        const statusChanged = xeroInvoice.Status !== invoice.status;
        const amountChanged = xeroInvoice.AmountDue !== invoice.amount_due || 
                             xeroInvoice.AmountPaid !== invoice.amount_paid;

        if (statusChanged || amountChanged) {
          // Fetch online payment URL
          let onlinePaymentUrl = invoice.online_payment_url;
          try {
            const onlineInvoiceResponse = await fetch(
              `https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoice.InvoiceID}/OnlineInvoice`,
              {
                headers: {
                  'Authorization': `Bearer ${connection.access_token}`,
                  'xero-tenant-id': connection.xero_tenant_id,
                  'Accept': 'application/json'
                }
              }
            );

            if (onlineInvoiceResponse.ok) {
              const onlineInvoiceResult = await onlineInvoiceResponse.json();
              onlinePaymentUrl = onlineInvoiceResult.OnlineInvoices?.[0]?.OnlineInvoiceUrl || onlinePaymentUrl;
            }
          } catch (err) {
            console.warn('Failed to fetch online invoice URL:', err);
          }

          // Determine if overdue
          let finalStatus = xeroInvoice.Status;
          if (xeroInvoice.DueDate && xeroInvoice.AmountDue > 0) {
            const dueDate = new Date(xeroInvoice.DueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (dueDate < today && xeroInvoice.Status !== 'PAID') {
              finalStatus = 'OVERDUE';
            }
          }

          // GUARDRAIL: Handle voided invoices - only unlink, don't delete project/job records
          if (finalStatus === 'VOIDED') {
            await base44.asServiceRole.entities.XeroInvoice.delete(invoice.id);
            
            if (invoice.job_id) {
              await base44.asServiceRole.entities.Job.update(invoice.job_id, {
                xero_invoice_id: null,
                xero_payment_url: null
              });
            }
            if (invoice.project_id) {
              await base44.asServiceRole.entities.Project.update(invoice.project_id, {
                xero_payment_url: null
              });
            }

            updated.push({
              invoice_number: invoice.xero_invoice_number,
              old_status: invoice.status,
              new_status: 'VOIDED (deleted)',
              action: 'deleted'
            });
          } else {
            // GUARDRAIL: Update invoice status/amounts only - preserve project_id and job_id links
            await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
              status: finalStatus,
              total_amount: xeroInvoice.Total,
              amount_due: xeroInvoice.AmountDue,
              amount_paid: xeroInvoice.AmountPaid || 0,
              online_payment_url: onlinePaymentUrl,
              raw_payload: xeroInvoice
            });

            // GUARDRAIL: Update payment URLs on linked records without changing the links themselves
            if (invoice.job_id) {
              await base44.asServiceRole.entities.Job.update(invoice.job_id, {
                xero_payment_url: onlinePaymentUrl
              });
            }
            if (invoice.project_id) {
              await base44.asServiceRole.entities.Project.update(invoice.project_id, {
                xero_payment_url: onlinePaymentUrl
              });
            }
          }

          updated.push({
            invoice_number: invoice.xero_invoice_number,
            old_status: invoice.status,
            new_status: finalStatus,
            old_amount_due: invoice.amount_due,
            new_amount_due: xeroInvoice.AmountDue
          });
        }
      } catch (error) {
        errors.push({
          invoice_number: invoice.xero_invoice_number,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total_checked: invoices.length,
      updated: updated.length,
      details: updated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Auto-sync Xero invoices error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});