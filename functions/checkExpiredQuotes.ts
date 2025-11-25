import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This can be called by a cron job or manually
    // Find all quotes that should be expired
    const activeQuotes = await base44.asServiceRole.entities.Quote.filter({
      status: { $in: ['Draft', 'Sent', 'Viewed'] }
    });

    const now = new Date();
    let expiredCount = 0;

    for (const quote of activeQuotes) {
      if (quote.expires_at && new Date(quote.expires_at) < now) {
        await base44.asServiceRole.entities.Quote.update(quote.id, { status: 'Expired' });
        expiredCount++;
      }
    }

    return Response.json({ 
      success: true, 
      message: `Checked ${activeQuotes.length} quotes, expired ${expiredCount}` 
    });

  } catch (error) {
    console.error('Check expired quotes error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});