import { createClientFromRequest } from './shared/sdk.js';
import { refreshAndGetXeroConnection, getXeroHeaders } from './shared/xeroHelpers.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function can be called via cron without user auth
    const connection = await refreshAndGetXeroConnection(base44);

    // Get all unpaid/partially paid invoices
    const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({
      status: { $in: ['AUTHORISED', 'SUBMITTED', 'OVERDUE'] }
    });

    const updates = [];
    const errors = [];

    for (const invoice of invoices) {
      try {
        // Fetch latest invoice data from Xero
        const response = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices/${invoice.xero_invoice_id}`,
          {
            headers: getXeroHeaders(connection)
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