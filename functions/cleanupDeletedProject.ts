import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BATCH_SIZE = 3; // Process 3 projects at a time to avoid rate limits
const DELAY_BETWEEN_PROJECTS = 500; // 500ms delay between projects
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanupSingleProject(serviceBase44, projectId) {
  console.log(`Cleaning up project ${projectId}...`);
  
  const stats = {
    xero_invoices: 0,
    email_threads: 0,
    quotes: 0,
    errors: []
  };

  try {
    // 1. Unlink all Xero invoices
    const xeroInvoices = await serviceBase44.entities.XeroInvoice.filter({ project_id: projectId });
    if (xeroInvoices.length > 0) {
      for (const invoice of xeroInvoices) {
        try {
          await serviceBase44.entities.XeroInvoice.update(invoice.id, {
            project_id: null,
            customer_id: null,
            customer_name: null
          });
          stats.xero_invoices++;
          await delay(100); // Small delay between updates
        } catch (err) {
          stats.errors.push(`Invoice ${invoice.id}: ${err.message}`);
        }
      }
    }

    // 2. Unlink all email threads (both fields)
    const emailThreads = await serviceBase44.entities.EmailThread.filter({ project_id: projectId });
    const linkedThreads = await serviceBase44.entities.EmailThread.filter({ linked_project_id: projectId });
    
    const allThreads = [...emailThreads, ...linkedThreads];
    if (allThreads.length > 0) {
      for (const thread of allThreads) {
        try {
          await serviceBase44.entities.EmailThread.update(thread.id, {
            project_id: null,
            project_number: null,
            project_title: null,
            linked_project_id: null,
            linked_project_title: null
          });
          stats.email_threads++;
          await delay(100); // Small delay between updates
        } catch (err) {
          stats.errors.push(`Thread ${thread.id}: ${err.message}`);
        }
      }
    }

    // 3. Unlink all quotes
    const quotes = await serviceBase44.entities.Quote.filter({ project_id: projectId });
    if (quotes.length > 0) {
      for (const quote of quotes) {
        try {
          await serviceBase44.entities.Quote.update(quote.id, {
            project_id: null
          });
          stats.quotes++;
          await delay(100); // Small delay between updates
        } catch (err) {
          stats.errors.push(`Quote ${quote.id}: ${err.message}`);
        }
      }
    }

    // 4. Clear project's primary links
    await serviceBase44.entities.Project.update(projectId, {
      primary_quote_id: null,
      primary_xero_invoice_id: null,
      primary_email_thread_id: null,
      xero_invoices: [],
      xero_payment_url: null
    });

    console.log(`Completed cleanup for project ${projectId}:`, stats);
  } catch (error) {
    console.error(`Error cleaning project ${projectId}:`, error);
    stats.errors.push(`Project ${projectId}: ${error.message}`);
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
      quotes: 0
    };

    const errors = [];
    let cleaned = 0;

    // Process in batches
    for (let i = 0; i < deletedProjects.length; i += BATCH_SIZE) {
      const batch = deletedProjects.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(deletedProjects.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum} of ${totalBatches} (${batch.length} projects)`);

      // Process batch sequentially with delays
      for (const project of batch) {
        const stats = await cleanupSingleProject(serviceBase44, project.id);
        totals.xero_invoices += stats.xero_invoices;
        totals.email_threads += stats.email_threads;
        totals.quotes += stats.quotes;
        
        if (stats.errors.length > 0) {
          errors.push(...stats.errors);
        }
        
        cleaned++;
        
        // Delay between projects within batch
        await delay(DELAY_BETWEEN_PROJECTS);
      }

      console.log(`Progress: ${cleaned}/${deletedProjects.length} projects cleaned`);

      // Longer delay between batches to avoid rate limits
      if (i + BATCH_SIZE < deletedProjects.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log('Batch cleanup completed successfully');

    return Response.json({
      success: true,
      total_cleaned: cleaned,
      totals,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully cleaned up ${cleaned} deleted project${cleaned !== 1 ? 's' : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    });

  } catch (error) {
    console.error('Error in batch cleanup:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});