import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sync Accepted Quotes to Projects
 * Finds all quotes with status "Accepted" and ensures their linked projects
 * are updated to "Quote Approved" stage
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    // Find all accepted quotes
    const acceptedQuotes = await base44.asServiceRole.entities.Quote.filter({
      status: 'Accepted'
    });

    console.log(`Found ${acceptedQuotes.length} accepted quotes`);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const quote of acceptedQuotes) {
      if (!quote.project_id) {
        console.log(`Quote ${quote.id} has no project_id, skipping`);
        skippedCount++;
        continue;
      }

      try {
        // Get current project
        const project = await base44.asServiceRole.entities.Project.get(quote.project_id);
        
        // Only update if not already at Quote Approved or beyond
        const stagesAfterQuoteApproved = ['Final Measure', 'Parts Ordered', 'Scheduled', 'Completed', 'Warranty'];
        
        if (project.status === 'Quote Approved' || stagesAfterQuoteApproved.includes(project.status)) {
          console.log(`Project ${quote.project_id} already at ${project.status}, skipping`);
          skippedCount++;
          continue;
        }

        // Update project to Quote Approved
        await base44.asServiceRole.entities.Project.update(quote.project_id, {
          status: 'Quote Approved'
        });

        console.log(`Updated project ${quote.project_id} to Quote Approved (quote: ${quote.id})`);
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update project ${quote.project_id}:`, error);
        errors.push({
          quote_id: quote.id,
          project_id: quote.project_id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total_quotes: acceptedQuotes.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('syncAcceptedQuotesToProjects error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});