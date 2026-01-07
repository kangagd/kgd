import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BATCH_SIZE = 10; // Process 10 projects at a time

async function cleanupSingleProject(serviceBase44, projectId) {
  console.log(`Cleaning up project ${projectId}...`);
  
  const stats = {
    xero_invoices: 0,
    email_threads: 0,
    quotes: 0
  };

  // 1. Unlink all Xero invoices
  const xeroInvoices = await serviceBase44.entities.XeroInvoice.filter({ project_id: projectId });
  for (const invoice of xeroInvoices) {
    await serviceBase44.entities.XeroInvoice.update(invoice.id, {
      project_id: null,
      customer_id: null,
      customer_name: null
    });
  }
  stats.xero_invoices = xeroInvoices.length;

  // 2. Unlink all email threads
  const emailThreads = await serviceBase44.entities.EmailThread.filter({ project_id: projectId });
  for (const thread of emailThreads) {
    await serviceBase44.entities.EmailThread.update(thread.id, {
      project_id: null,
      project_number: null,
      project_title: null
    });
  }

  // Also check linked_project_id field
  const linkedThreads = await serviceBase44.entities.EmailThread.filter({ linked_project_id: projectId });
  for (const thread of linkedThreads) {
    await serviceBase44.entities.EmailThread.update(thread.id, {
      linked_project_id: null,
      linked_project_title: null
    });
  }
  stats.email_threads = emailThreads.length + linkedThreads.length;

  // 3. Unlink all quotes
  const quotes = await serviceBase44.entities.Quote.filter({ project_id: projectId });
  for (const quote of quotes) {
    await serviceBase44.entities.Quote.update(quote.id, {
      project_id: null
    });
  }
  stats.quotes = quotes.length;

  // 4. Clear project's primary links (already has deleted_at)
  await serviceBase44.entities.Project.update(projectId, {
    primary_quote_id: null,
    primary_xero_invoice_id: null,
    primary_email_thread_id: null,
    xero_invoices: [],
    xero_payment_url: null
  });

  console.log(`Completed cleanup for project ${projectId}:`, stats);
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
      quotes: 0
    };

    let cleaned = 0;

    // Process in batches
    for (let i = 0; i < deletedProjects.length; i += BATCH_SIZE) {
      const batch = deletedProjects.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(deletedProjects.length / BATCH_SIZE)} (${batch.length} projects)`);

      // Process batch sequentially to avoid overwhelming the system
      for (const project of batch) {
        const stats = await cleanupSingleProject(serviceBase44, project.id);
        totals.xero_invoices += stats.xero_invoices;
        totals.email_threads += stats.email_threads;
        totals.quotes += stats.quotes;
        cleaned++;
      }

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