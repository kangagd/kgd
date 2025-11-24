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

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    // Get our invoice record
    const invoiceRecord = await base44.asServiceRole.entities.XeroInvoice.get(invoice_id);
    if (!invoiceRecord) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const connection = await refreshAndGetConnection(base44);

    // Fetch latest invoice data from Xero
    const xeroResponse = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceRecord.xero_invoice_id}`,
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Accept': 'application/json'
        }
      }
    );

    if (!xeroResponse.ok) {
      const error = await xeroResponse.text();
      throw new Error(`Xero API error: ${error}`);
    }

    const xeroResult = await xeroResponse.json();
    const xeroInvoice = xeroResult.Invoices[0];

    // Extract online payment URL from Xero response
    const onlinePaymentUrl = xeroInvoice.OnlineInvoiceUrl || null;

    // If invoice is voided, delete it from the app
    if (xeroInvoice.Status === 'VOIDED') {
      // Unlink from job if linked
      if (invoiceRecord.job_id) {
        await base44.asServiceRole.entities.Job.update(invoiceRecord.job_id, {
          xero_invoice_id: null,
          xero_payment_url: null
        });
      }

      // Unlink from project if linked
      if (invoiceRecord.project_id) {
        const project = await base44.asServiceRole.entities.Project.get(invoiceRecord.project_id);
        if (project && project.xero_payment_url) {
          await base44.asServiceRole.entities.Project.update(invoiceRecord.project_id, {
            xero_payment_url: null
          });
        }
      }

      // Delete the invoice record
      await base44.asServiceRole.entities.XeroInvoice.delete(invoice_id);

      return Response.json({
        success: true,
        voided: true,
        message: 'Invoice was voided in Xero and removed from the app'
      });
    }

    // Determine if invoice is overdue
    let finalStatus = xeroInvoice.Status;
    if (xeroInvoice.DueDate && xeroInvoice.AmountDue > 0) {
      const dueDate = new Date(xeroInvoice.DueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDate < today && xeroInvoice.Status !== 'PAID') {
        finalStatus = 'OVERDUE';
      }
    }

    // Extract last payment date from Payments array
    let lastPaymentDate = null;
    if (xeroInvoice.Payments && xeroInvoice.Payments.length > 0) {
      const sortedPayments = xeroInvoice.Payments.sort((a, b) => 
        new Date(b.Date) - new Date(a.Date)
      );
      lastPaymentDate = sortedPayments[0].Date;
    }

    // Calculate total credit notes
    let creditNotesTotal = 0;
    if (xeroInvoice.CreditNotes && xeroInvoice.CreditNotes.length > 0) {
      creditNotesTotal = xeroInvoice.CreditNotes.reduce((sum, cn) => sum + (cn.Total || 0), 0);
    }

    // Update our invoice record with latest data
    const updatedInvoice = await base44.asServiceRole.entities.XeroInvoice.update(invoice_id, {
      status: finalStatus,
      total_amount: xeroInvoice.Total,
      amount_due: xeroInvoice.AmountDue,
      amount_paid: xeroInvoice.AmountPaid || 0,
      payment_terms: xeroInvoice.Terms || null,
      credit_notes_total: creditNotesTotal,
      last_payment_date: lastPaymentDate,
      raw_payload: xeroInvoice
    });

    // Update payment URL on linked job if it exists
    if (invoiceRecord.job_id) {
      await base44.asServiceRole.entities.Job.update(invoiceRecord.job_id, {
        xero_payment_url: onlinePaymentUrl
      });
    }

    // Update payment URL on linked project if it exists
    if (invoiceRecord.project_id) {
      await base44.asServiceRole.entities.Project.update(invoiceRecord.project_id, {
        xero_payment_url: onlinePaymentUrl
      });
    }

    return Response.json({
      success: true,
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Sync invoice status error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});