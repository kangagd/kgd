/**
 * batchLinkAllEmailThreads - Auto-link all unlinked email threads to projects
 * 
 * Processes all EmailThreads without project_id and attempts to match them to projects
 * based on sender/recipient email addresses matching customer or organisation emails.
 * 
 * Admin-only function.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only check
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[batchLinkAllEmailThreads] Starting batch link operation');

    // Fetch all unlinked threads
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const unlinkedThreads = allThreads.filter(t => !t.project_id);
    
    console.log(`[batchLinkAllEmailThreads] Found ${unlinkedThreads.length} unlinked threads`);

    // Fetch all projects, customers, organisations for matching
    const [allProjects, allCustomers, allOrganisations] = await Promise.all([
      base44.asServiceRole.entities.Project.list(),
      base44.asServiceRole.entities.Customer.list(),
      base44.asServiceRole.entities.Organisation.list()
    ]);

    console.log(`[batchLinkAllEmailThreads] Loaded ${allProjects.length} projects, ${allCustomers.length} customers, ${allOrganisations.length} organisations`);

    let linkedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each unlinked thread
    for (const thread of unlinkedThreads) {
      try {
        const threadEmails = new Set([
          ...(thread.from_address ? [thread.from_address.toLowerCase()] : []),
          ...(thread.to_addresses ? thread.to_addresses.map(e => e?.toLowerCase()) : [])
        ].filter(Boolean));

        let matchedProject = null;

        // Try to match by customer email
        for (const project of allProjects) {
          if (threadEmails.has(project.customer_email?.toLowerCase())) {
            matchedProject = project;
            break;
          }
        }

        // If no customer email match, try organisation emails
        if (!matchedProject) {
          for (const project of allProjects) {
            if (project.organisation_id) {
              const org = allOrganisations.find(o => o.id === project.organisation_id);
              if (org?.email && threadEmails.has(org.email.toLowerCase())) {
                matchedProject = project;
                break;
              }
            }
          }
        }

        if (!matchedProject) {
          skippedCount++;
          continue;
        }

        // Link thread to matched project
        await base44.asServiceRole.entities.EmailThread.update(thread.id, {
          project_id: matchedProject.id,
          project_number: matchedProject.project_number || null,
          project_title: matchedProject.title || null,
          customer_id: matchedProject.customer_id || null,
          customer_name: matchedProject.customer_name || null,
          organisation_id: matchedProject.organisation_id || null,
          organisation_name: matchedProject.organisation_name || null,
          linked_to_project_at: new Date().toISOString(),
          linked_to_project_by: 'system'
        });

        linkedCount++;
        console.log(`[batchLinkAllEmailThreads] Linked thread ${thread.id} to project ${matchedProject.id}`);

      } catch (error) {
        console.error(`[batchLinkAllEmailThreads] Error linking thread ${thread.id}:`, error);
        errorCount++;
        errors.push({
          thread_id: thread.id,
          error: error.message
        });
      }
    }

    console.log(`[batchLinkAllEmailThreads] Complete: ${linkedCount} linked, ${skippedCount} skipped, ${errorCount} errors`);

    return Response.json({
      success: true,
      total_unlinked: unlinkedThreads.length,
      linked_count: linkedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[batchLinkAllEmailThreads] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});