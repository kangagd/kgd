import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { project_id } = await req.json();

    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Use service role for cleanup operations
    const serviceBase44 = base44.asServiceRole;

    // 1. Unlink all Xero invoices
    const xeroInvoices = await serviceBase44.entities.XeroInvoice.filter({ project_id });
    for (const invoice of xeroInvoices) {
      await serviceBase44.entities.XeroInvoice.update(invoice.id, {
        project_id: null,
        customer_id: null,
        customer_name: null
      });
    }

    // 2. Unlink all email threads
    const emailThreads = await serviceBase44.entities.EmailThread.filter({ project_id });
    for (const thread of emailThreads) {
      await serviceBase44.entities.EmailThread.update(thread.id, {
        project_id: null,
        project_number: null,
        project_title: null
      });
    }

    // Also check linked_project_id field
    const linkedThreads = await serviceBase44.entities.EmailThread.filter({ linked_project_id: project_id });
    for (const thread of linkedThreads) {
      await serviceBase44.entities.EmailThread.update(thread.id, {
        linked_project_id: null,
        linked_project_title: null
      });
    }

    // 3. Unlink all quotes
    const quotes = await serviceBase44.entities.Quote.filter({ project_id });
    for (const quote of quotes) {
      await serviceBase44.entities.Quote.update(quote.id, {
        project_id: null
      });
    }

    // 4. Update project's primary links
    await serviceBase44.entities.Project.update(project_id, {
      primary_quote_id: null,
      primary_xero_invoice_id: null,
      primary_email_thread_id: null,
      xero_invoices: [],
      xero_payment_url: null,
      deleted_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      cleaned: {
        xero_invoices: xeroInvoices.length,
        email_threads: emailThreads.length + linkedThreads.length,
        quotes: quotes.length
      }
    });

  } catch (error) {
    console.error('Error cleaning up deleted project:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});