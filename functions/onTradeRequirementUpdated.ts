import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tradeId, wasBooked, isBooked } = await req.json();

    // Third-party trades do not auto-create jobs
    // Simply acknowledge the update
    return Response.json({ 
      message: 'Trade requirement updated - no job auto-creation',
      created: false,
      updated: false
    });
  } catch (error) {
    console.error('Trade requirement update error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});