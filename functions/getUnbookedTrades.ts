import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trades = await base44.asServiceRole.entities.ProjectTradeRequirement.filter({ 
      status: 'Required'
    });

    return Response.json({ trades: trades || [] });

  } catch (error) {
    console.error('[getUnbookedTrades] Error:', error);
    return Response.json({ 
      trades: [], 
      error: 'Failed to fetch unbooked trades' 
    }, { status: 200 });
  }
});