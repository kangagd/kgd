import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@14.10.0';

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

    const { invoice_id, payment_amount, payment_method_id, stripe_fee, total_charge } = await req.json();

    if (!invoice_id || !payment_amount || !payment_method_id) {
      return Response.json({ error: 'invoice_id, payment_amount, and payment_method_id are required' }, { status: 400 });
    }

    // Use total_charge (including fee) for Stripe, payment_amount for Xero
    const amountToCharge = total_charge || payment_amount;

    // Get invoice record
    const invoiceRecord = await base44.asServiceRole.entities.XeroInvoice.get(invoice_id);
    if (!invoiceRecord) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Process payment with Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }
    
    const stripe = new Stripe(stripeSecretKey);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountToCharge * 100), // Convert to cents (includes processing fee)
      currency: 'aud',
      payment_method: payment_method_id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      description: `Payment for Invoice #${invoiceRecord.xero_invoice_number}${stripe_fee ? ` (incl. $${stripe_fee.toFixed(2)} processing fee)` : ''}`,
      metadata: {
        invoice_id: invoice_id,
        xero_invoice_id: invoiceRecord.xero_invoice_id,
        customer_name: invoiceRecord.customer_name,
        invoice_amount: payment_amount.toString(),
        processing_fee: stripe_fee?.toString() || '0',
        total_charged: amountToCharge.toString()
      }
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment failed');
    }

    // Record payment in Xero
    const connection = await refreshAndGetConnection(base44);
    
    // Get Xero settings for account code
    const settings = await base44.asServiceRole.entities.XeroSettings.list();
    const bankAccountCode = settings[0]?.bank_account_code || '200';
    
    const paymentPayload = {
      Invoice: {
        InvoiceID: invoiceRecord.xero_invoice_id
      },
      Account: {
        Code: bankAccountCode
      },
      Date: new Date().toISOString().split('T')[0],
      Amount: payment_amount
    };

    const xeroResponse = await fetch('https://api.xero.com/api.xro/2.0/Payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'xero-tenant-id': connection.xero_tenant_id,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    });

    if (!xeroResponse.ok) {
      const error = await xeroResponse.text();
      console.error('Xero payment error:', error);
      throw new Error(`Failed to record payment in Xero: ${error}`);
    }

    const xeroResult = await xeroResponse.json();
    const xeroPayment = xeroResult.Payments[0];

    // Fetch updated invoice from Xero
    const invoiceResponse = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceRecord.xero_invoice_id}`,
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Accept': 'application/json'
        }
      }
    );

    const invoiceResult = await invoiceResponse.json();
    const updatedXeroInvoice = invoiceResult.Invoices[0];

    // Update local invoice record
    const updatedInvoice = await base44.asServiceRole.entities.XeroInvoice.update(invoice_id, {
      status: updatedXeroInvoice.Status,
      amount_due: updatedXeroInvoice.AmountDue,
      amount_paid: updatedXeroInvoice.AmountPaid || 0,
      raw_payload: updatedXeroInvoice
    });

    return Response.json({
      success: true,
      payment_intent_id: paymentIntent.id,
      xero_payment_id: xeroPayment.PaymentID,
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Process payment error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process payment',
      details: error.stack
    }, { status: 500 });
  }
});