import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MAX_EXECUTION_TIME = 50000; // 50 seconds
const DELAY_BETWEEN_PROJECTS = 1000; // 1 second delay

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanupSingleProject(serviceBase44, projectId) {
  const stats = { xero_invoices: 0, email_threads: 0, quotes: 0 };

  // 1. Unlink Xero invoices
  const xeroInvoices = await serviceBase44.entities.XeroInvoice.filter({ project_id: projectId });
  for (const invoice of xeroInvoices) {
    await serviceBase44.entities.XeroInvoice.update(invoice.id, {
      project_id: null,
      customer_id: null,
      customer_name: null
    });
    stats.xero_invoices++;
    await delay(200);
  }

  // 2. Unlink email threads
  const threads1 = await serviceBase44.entities.EmailThread.filter({ project_id: projectId });
  const threads2 = await serviceBase44.entities.EmailThread.filter({ linked_project_id: projectId });
  
  for (const thread of [...threads1, ...threads2]) {
    await serviceBase44.entities.EmailThread.update(thread.id, {
      project_id: null,
      project_number: null,
      project_title: null,
      linked_project_id: null,
      linked_project_title: null
    });
    stats.email_threads++;
    await delay(200);
  }

  // 3. Unlink quotes
  const quotes = await serviceBase44.entities.Quote.filter({ project_id: projectId });
  for (const quote of quotes) {
    await serviceBase44.entities.Quote.update(quote.id, {
      project_id: null
    });
    stats.quotes++;
    await delay(200);
  }

  // 4. Clear project links
  await serviceBase44.entities.Project.update(projectId, {
    primary_quote_id: null,
    primary_xero_invoice_id: null,
    primary_email_thread_id: null,
    xero_invoices: [],
    xero_payment_url: null
  });

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

    const startTime = Date.now();
    let cleaned = 0;

    // Process one project at a time with delays and timeout protection
    for (let i = 0; i < deletedProjects.length; i++) {
      // Check timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log(`Timeout protection: Processed ${cleaned} of ${deletedProjects.length}`);
        return Response.json({
          success: true,
          partial: true,
          total_cleaned: cleaned,
          remaining: deletedProjects.length - cleaned,
          totals,
          message: `Cleaned ${cleaned} of ${deletedProjects.length} projects. Run again to continue.`
        });
      }

      const project = deletedProjects[i];
      console.log(`[${i + 1}/${deletedProjects.length}] Cleaning project ${project.id}...`);

      const stats = await cleanupSingleProject(serviceBase44, project.id);
      totals.xero_invoices += stats.xero_invoices;
      totals.email_threads += stats.email_threads;
      totals.quotes += stats.quotes;
      cleaned++;

      // Delay between projects
      if (i < deletedProjects.length - 1) {
        await delay(DELAY_BETWEEN_PROJECTS);
      }
    }

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