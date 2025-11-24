import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@14.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    // Get raw body for signature verification
    const body = await req.text();

    // Verify webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    console.log('Stripe webhook event received:', event.type);

    // Handle payment success events
    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const base44 = createClientFromRequest(req);
      
      let invoiceId = null;

      // Extract invoice ID from metadata
      if (event.type === 'checkout.session.completed') {
        invoiceId = event.data.object.metadata?.invoice_id;
      } else if (event.type === 'payment_intent.succeeded') {
        invoiceId = event.data.object.metadata?.invoice_id;
      }

      if (invoiceId) {
        console.log('Payment successful for invoice:', invoiceId);
        
        // Sync invoice status with Xero
        try {
          const syncResponse = await base44.asServiceRole.functions.invoke('syncXeroInvoiceStatus', {
            invoice_id: invoiceId
          });

          console.log('Xero invoice synced successfully:', syncResponse.data);
        } catch (error) {
          console.error('Failed to sync invoice with Xero:', error);
          // Don't return error - webhook should still succeed even if sync fails
        }
      }
    }

    return Response.json({ received: true });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});