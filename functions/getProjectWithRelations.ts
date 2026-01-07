import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id } = await req.json();
    
    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch all data in parallel using service role for better performance
    const [
      project,
      jobs,
      quotes,
      xeroInvoices,
      parts,
      purchaseOrders,
      projectContacts,
      tradeRequirements,
      projectTasks,
      projectMessages,
      projectEmails,
      emailThreads
    ] = await Promise.all([
      base44.asServiceRole.entities.Project.get(project_id),
      base44.asServiceRole.entities.Job.filter({ 
        project_id, 
        deleted_at: { $exists: false } 
      }),
      base44.asServiceRole.entities.Quote.filter({ project_id }),
      base44.asServiceRole.entities.XeroInvoice.filter({ project_id }),
      base44.asServiceRole.entities.Part.filter({ project_id }),
      base44.asServiceRole.entities.PurchaseOrder.filter({ project_id }),
      base44.asServiceRole.entities.ProjectContact.filter({ project_id }),
      base44.asServiceRole.entities.ProjectTradeRequirement.filter({ project_id }),
      base44.asServiceRole.entities.Task.filter({ project_id }),
      base44.asServiceRole.entities.ProjectMessage.filter({ project_id }),
      base44.asServiceRole.entities.ProjectEmail.filter({ project_id }),
      base44.asServiceRole.entities.EmailThread.filter({ project_id })
    ]);

    // Deduplicate Xero invoices by xero_invoice_id
    const uniqueXeroInvoices = xeroInvoices.reduce((acc, inv) => {
      if (!acc.find(i => i.xero_invoice_id === inv.xero_invoice_id)) {
        acc.push(inv);
      }
      return acc;
    }, []);

    return Response.json({
      project,
      jobs,
      quotes,
      xeroInvoices: uniqueXeroInvoices,
      parts,
      purchaseOrders,
      projectContacts,
      tradeRequirements,
      projectTasks,
      projectMessages,
      projectEmails,
      emailThreads
    });

  } catch (error) {
    console.error('Error fetching project with relations:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch project data' 
    }, { status: 500 });
  }
});