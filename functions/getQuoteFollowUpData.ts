import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetches and categorizes quotes for admin dashboard follow-up section
 * Categories:
 * - HOT: Sent in last 24 hours
 * - WARM: Sent 1-5 days ago with NO activity (email, task, quote status change)
 * - COLD: Expiring within 5 days
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

        // Batch fetch all quotes and projects upfront (avoid N+1)
        const allQuotes = await base44.asServiceRole.entities.Quote.filter({ status: 'Sent' });
        const allProjects = await base44.asServiceRole.entities.Project.list('-updated_date', 500);
        const projectMap = new Map(allProjects.map(p => [p.id, p]));

        // Categorize quotes WITHOUT activity checks (performance)
        const hotQuotes = [];
        const warmQuotes = [];
        const coldQuotes = [];
        const processedIds = new Set();

        // HOT: Sent within last 24 hours
        for (const quote of allQuotes) {
          const sentDate = new Date(quote.sent_at);
          if (sentDate >= oneDayAgo && sentDate <= now) {
            const project = projectMap.get(quote.project_id);
            if (!project) continue;

            hotQuotes.push({
              id: quote.id,
              project_id: project.id,
              project_number: project.project_number,
              project_title: project.title,
              customer_name: project.customer_name,
              sent_at: quote.sent_at,
              quote_viewed: quote.quote_viewed || false,
              hours_since_sent: Math.round((now - sentDate) / (1000 * 60 * 60))
            });
            processedIds.add(quote.id);
          }
        }

        // WARM: Sent 1-5 days ago (no activity check - assume needs follow-up)
        for (const quote of allQuotes) {
          if (processedIds.has(quote.id)) continue;

          const sentDate = new Date(quote.sent_at);
          if (sentDate >= fiveDaysAgo && sentDate < oneDayAgo) {
            const project = projectMap.get(quote.project_id);
            if (!project) continue;

            warmQuotes.push({
              id: quote.id,
              project_id: project.id,
              project_number: project.project_number,
              project_title: project.title,
              customer_name: project.customer_name,
              sent_at: quote.sent_at,
              hours_since_sent: Math.round((now - sentDate) / (1000 * 60 * 60))
            });
            processedIds.add(quote.id);
          }
        }

        // COLD: Expiring within 5 days
        for (const quote of allQuotes) {
          if (processedIds.has(quote.id)) continue;

          const expiryDate = quote.expires_at ? new Date(quote.expires_at) : null;
          if (expiryDate && expiryDate >= now && expiryDate <= fiveDaysFromNow) {
            const project = projectMap.get(quote.project_id);
            if (!project) continue;

            coldQuotes.push({
              id: quote.id,
              project_id: project.id,
              project_number: project.project_number,
              project_title: project.title,
              customer_name: project.customer_name,
              sent_at: quote.sent_at,
              quote_expires_at: quote.expires_at,
              days_until_expiry: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
            });
          }
        }

    return Response.json({
      success: true,
      hot: hotQuotes,
      warm: warmQuotes,
      cold: coldQuotes,
      summary: {
        total_hot: hotQuotes.length,
        total_warm: warmQuotes.length,
        total_cold: coldQuotes.length
      }
    });
  } catch (error) {
    console.error('Quote follow-up data error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});