import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
    
    if (!publishableKey) {
      return Response.json({ error: 'Stripe publishable key not configured' }, { status: 500 });
    }

    return Response.json({ publishable_key: publishableKey });

  } catch (error) {
    console.error('Get Stripe key error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});