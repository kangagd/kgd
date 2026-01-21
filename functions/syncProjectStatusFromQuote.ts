import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Syncs project status based on Quote status changes
 * Triggered by entity automation when a Quote is updated
 * 
 * Rules:
 * - "Sent" → Project "Quote Sent" (only if currently at Lead/Initial Site Visit/Create Quote)
 * - "Accepted" → Project "Quote Approved" (only if currently at Quote Sent)
 * - "Rejected"/"Expired" → Create attention item (don't regress project status)
 * - Only processes primary quote (first in project's quote_ids array)
 * - Manual project status changes are NOT overridden
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { event, data } = await req.json();

    if (!data || !data.id) {
      return Response.json({ error: 'Quote data required' }, { status: 400 });
    }

    const quote = data;
    const quoteStatus = quote.status;

    // Find all projects linked to this quote
    const projects = await base44.asServiceRole.entities.Project.filter({
      quote_ids: quote.id
    });

    let updatedCount = 0;
    let attentionItemsCreated = 0;

    for (const project of projects) {
      // Only process if this quote is the primary quote (first in array)
      const isPrimaryQuote = project.quote_ids && project.quote_ids[0] === quote.id;
      
      if (!isPrimaryQuote) {
        console.log(`[Quote Sync] Quote ${quote.id} is not primary for project ${project.id}, skipping`);
        continue;
      }

      const currentStatus = project.status;

      // Determine target status based on quote status
      let targetStatus = null;

      if (quoteStatus === 'Sent') {
        // Only advance to "Quote Sent" from earlier stages
        if (['Lead', 'Initial Site Visit', 'Create Quote'].includes(currentStatus)) {
          targetStatus = 'Quote Sent';
        }
      } else if (quoteStatus === 'Accepted') {
        // Only advance to "Quote Approved" if currently at "Quote Sent"
        if (currentStatus === 'Quote Sent') {
          targetStatus = 'Quote Approved';
        }
      } else if (['Rejected', 'Expired'].includes(quoteStatus)) {
        // Create attention item instead of regressing
        try {
          await base44.asServiceRole.entities.AttentionItem.create({
            project_id: project.id,
            project_number: project.project_number,
            project_title: project.title,
            type: 'quote_' + quoteStatus.toLowerCase(),
            title: `Quote ${quoteStatus}`,
            description: `Quote #${quote.id} was ${quoteStatus.toLowerCase()} and may need follow-up`,
            priority: quoteStatus === 'Expired' ? 'high' : 'normal',
            status: 'open',
            created_by_email: user.email,
            created_by_name: user.full_name || user.display_name || user.email
          });
          attentionItemsCreated++;
          console.log(`[Quote Sync] Created attention item for ${quoteStatus} quote on project ${project.id}`);
        } catch (err) {
          console.error(`[Quote Sync] Failed to create attention item for project ${project.id}:`, err);
        }
      }

      // Update project status if target was determined
      if (targetStatus && targetStatus !== currentStatus) {
        try {
          await base44.asServiceRole.entities.Project.update(project.id, {
            status: targetStatus,
            last_activity_at: new Date().toISOString(),
            last_activity_type: `Quote ${quoteStatus} → Project ${targetStatus}`
          });
          updatedCount++;
          console.log(`[Quote Sync] Updated project ${project.id} status from ${currentStatus} to ${targetStatus}`);
        } catch (err) {
          console.error(`[Quote Sync] Failed to update project ${project.id}:`, err);
        }
      }
    }

    return Response.json({
      success: true,
      quote_id: quote.id,
      quote_status: quoteStatus,
      projects_updated: updatedCount,
      attention_items_created: attentionItemsCreated
    });
  } catch (error) {
    console.error('Quote sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});