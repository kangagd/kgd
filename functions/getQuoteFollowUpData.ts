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

    // Get all quotes with status "Sent" from last 5 days
    const quotes = await base44.asServiceRole.entities.Quote.filter({
      status: 'Sent'
    });

    const sentInWindow = quotes.filter(q => {
      const sentDate = new Date(q.sent_at);
      return sentDate >= fiveDaysAgo && sentDate <= now;
    });

    const hotQuotes = [];
    const warmQuotes = [];
    const coldQuotes = [];
    const processedQuoteIds = new Set();

    for (const quote of sentInWindow) {
      const sentDate = new Date(quote.sent_at);
      const project = await base44.asServiceRole.entities.Project.get(quote.project_id);

      if (!project) continue;

      const quoteData = {
        id: quote.id,
        project_id: project.id,
        project_number: project.project_number,
        project_title: project.title,
        customer_name: project.customer_name,
        sent_at: quote.sent_at,
        quote_viewed: quote.quote_viewed || false,
        quote_expires_at: quote.expires_at,
        hours_since_sent: Math.round((now - sentDate) / (1000 * 60 * 60))
      };

      // HOT: Sent within last 24 hours
      if (sentDate >= oneDayAgo) {
        hotQuotes.push(quoteData);
        processedQuoteIds.add(quote.id);
        continue;
      }

      // Quick activity check (skip expensive queries if quote_viewed)
      let hasActivity = quote.quote_viewed || false;

      // Only check threads/tasks if quote wasn't viewed
      if (!hasActivity) {
        try {
          const threads = await base44.asServiceRole.entities.EmailThread.filter({
            project_id: project.id
          });
          hasActivity = threads.some(t => t.last_message_date && new Date(t.last_message_date) >= sentDate);
        } catch (err) {
          console.warn(`Email thread check failed for project ${project.id}`);
        }
      }

      if (!hasActivity) {
        try {
          const tasks = await base44.asServiceRole.entities.Task.filter({
            project_id: project.id
          });
          hasActivity = tasks.some(t => new Date(t.created_date) >= sentDate);
        } catch (err) {
          console.warn(`Task check failed for project ${project.id}`);
        }
      }

      // WARM: Sent 1-5 days ago with NO activity
      if (!hasActivity) {
        warmQuotes.push(quoteData);
        processedQuoteIds.add(quote.id);
      }
    }

    // COLD: Get quotes expiring within 5 days (status still "Sent")
    for (const quote of quotes) {
      if (processedQuoteIds.has(quote.id)) continue; // Skip already processed

      const expiryDate = quote.expires_at ? new Date(quote.expires_at) : null;
      if (expiryDate && expiryDate >= now && expiryDate <= fiveDaysFromNow) {
        const project = await base44.asServiceRole.entities.Project.get(quote.project_id);
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