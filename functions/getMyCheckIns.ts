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

    const checkIns = await base44.asServiceRole.entities.CheckInOut.list('-created_date', 10);

    return Response.json({ checkIns: checkIns || [] });

  } catch (error) {
    console.error('[getMyCheckIns] Error:', error);
    return Response.json({ 
      checkIns: [], 
      error: 'Failed to fetch check-ins' 
    }, { status: 200 });
  }
});