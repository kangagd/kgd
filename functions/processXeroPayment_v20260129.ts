import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { refreshAndGetXeroConnection, getXeroHeaders } from './shared/xeroHelpers.ts';

console.log("[DEPLOY_SENTINEL] processXeroPayment_v20260129 v=2026-01-29");

const VERSION = "2026-01-29";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { xero_invoice_id, amount, payment_date } = body;

    if (!xero_invoice_id || amount === undefined || amount === null) {
      return Response.json({ error: 'xero_invoice_id and amount are required' }, { status: 400 });
    }

    const connection = await refreshAndGetXeroConnection(base44);

    // Create payment in Xero
    const paymentPayload = {
      Invoice: {
        InvoiceID: xero_invoice_id
      },
      Account: {
        Code: "200" // Default bank account code
      },
      Amount: amount,
      PaymentDate: payment_date || new Date().toISOString().split('T')[0]
    };

    const paymentResponse = await fetch('https://api.xero.com/api.xro/2.0/Payments', {
      method: 'POST',
      headers: getXeroHeaders(connection),
      body: JSON.stringify(paymentPayload)
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      console.error('Xero payment error:', error);
      return Response.json({ error: `Failed to process payment: ${error}` }, { status: 500 });
    }

    const paymentResult = await paymentResponse.json();
    const payment = paymentResult.Payments?.[0];

    // Find and update local XeroInvoice record
    const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({
      xero_invoice_id: xero_invoice_id
    });

    if (invoices.length > 0) {
      const invoice = invoices[0];
      await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
        amount_paid: (invoice.amount_paid || 0) + amount,
        amount_due: Math.max(0, (invoice.amount_due || 0) - amount),
        last_payment_date: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      payment: payment,
      version: VERSION
    });

  } catch (error) {
    console.error('Process payment error:', error);
    return Response.json({ error: error.message, version: VERSION }, { status: 500 });
  }
});