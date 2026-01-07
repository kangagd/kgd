import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BATCH_SIZE = 5; // Process 5 projects per batch
const MAX_EXECUTION_TIME = 50000; // 50 seconds (leave 10s buffer for Deno's 60s limit)

async function cleanupBatch(serviceBase44, projectIds) {
  console.log(`Cleaning up ${projectIds.length} projects...`);
  
  const stats = {
    xero_invoices: 0,
    email_threads: 0,
    quotes: 0,
    projects: 0
  };

  // Fetch all related data at once for efficiency
  const allXeroInvoices = await serviceBase44.entities.XeroInvoice.list();
  const allEmailThreads = await serviceBase44.entities.EmailThread.list();
  const allQuotes = await serviceBase44.entities.Quote.list();

  // Filter to only those linked to deleted projects
  const invoicesToUnlink = allXeroInvoices.filter(inv => projectIds.includes(inv.project_id));
  const threadsToUnlink = allEmailThreads.filter(t => 
    projectIds.includes(t.project_id) || projectIds.includes(t.linked_project_id)
  );
  const quotesToUnlink = allQuotes.filter(q => projectIds.includes(q.project_id));

  // Unlink in parallel batches
  const updatePromises = [];

  // Unlink invoices
  for (const invoice of invoicesToUnlink) {
    updatePromises.push(
      serviceBase44.entities.XeroInvoice.update(invoice.id, {
        project_id: null,
        customer_id: null,
        customer_name: null
      }).then(() => stats.xero_invoices++)
    );
  }

  // Unlink threads
  for (const thread of threadsToUnlink) {
    updatePromises.push(
      serviceBase44.entities.EmailThread.update(thread.id, {
        project_id: null,
        project_number: null,
        project_title: null,
        linked_project_id: null,
        linked_project_title: null
      }).then(() => stats.email_threads++)
    );
  }

  // Unlink quotes
  for (const quote of quotesToUnlink) {
    updatePromises.push(
      serviceBase44.entities.Quote.update(quote.id, {
        project_id: null
      }).then(() => stats.quotes++)
    );
  }

  // Execute all updates in parallel
  await Promise.allSettled(updatePromises);

  // Clear project primary links
  for (const projectId of projectIds) {
    await serviceBase44.entities.Project.update(projectId, {
      primary_quote_id: null,
      primary_xero_invoice_id: null,
      primary_email_thread_id: null,
      xero_invoices: [],
      xero_payment_url: null
    });
    stats.projects++;
  }

  return stats;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // Use service role for cleanup operations
    const serviceBase44 = base44.asServiceRole;

    console.log('Starting batch cleanup of deleted projects...');

    // Fetch all deleted projects
    const deletedProjects = await serviceBase44.entities.Project.filter({
      deleted_at: { $exists: true }
    });

    console.log(`Found ${deletedProjects.length} deleted projects to clean up`);

    if (deletedProjects.length === 0) {
      return Response.json({
        success: true,
        message: 'No deleted projects found',
        total_cleaned: 0,
        totals: {
          xero_invoices: 0,
          email_threads: 0,
          quotes: 0
        }
      });
    }

    const totals = {
      xero_invoices: 0,
      email_threads: 0,
      quotes: 0,
      projects: 0
    };

    const startTime = Date.now();
    let cleaned = 0;

    // Process in batches with timeout protection
    for (let i = 0; i < deletedProjects.length; i += BATCH_SIZE) {
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME) {
        console.log(`Stopping early to avoid timeout. Processed ${cleaned} of ${deletedProjects.length} projects.`);
        return Response.json({
          success: true,
          partial: true,
          total_cleaned: cleaned,
          remaining: deletedProjects.length - cleaned,
          totals,
          message: `Cleaned ${cleaned} of ${deletedProjects.length} projects (stopped to avoid timeout). Run again to continue.`
        });
      }

      const batch = deletedProjects.slice(i, i + BATCH_SIZE);
      const batchProjectIds = batch.map(p => p.id);
      
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} projects)`);

      const batchStats = await cleanupBatch(serviceBase44, batchProjectIds);
      totals.xero_invoices += batchStats.xero_invoices;
      totals.email_threads += batchStats.email_threads;
      totals.quotes += batchStats.quotes;
      totals.projects += batchStats.projects;
      cleaned += batch.length;

      console.log(`Progress: ${cleaned}/${deletedProjects.length} projects cleaned`);
    }

    console.log('Batch cleanup completed successfully');

    return Response.json({
      success: true,
      total_cleaned: cleaned,
      totals,
      message: `Successfully cleaned up ${cleaned} deleted project${cleaned !== 1 ? 's' : ''}`
    });

  } catch (error) {
    console.error('Error in batch cleanup:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});