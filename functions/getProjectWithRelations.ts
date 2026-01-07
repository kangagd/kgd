import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id } = await req.json();

    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Fetch all related data in parallel
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
      emailThreads
    ] = await Promise.all([
      base44.entities.Project.get(project_id).catch(() => null),
      base44.entities.Job.filter({ 
        project_id, 
        deleted_at: { $exists: false } 
      }).catch(() => []),
      base44.entities.Quote.filter({ project_id }).catch(() => []),
      base44.entities.XeroInvoice.filter({ project_id }).catch(() => []),
      base44.entities.Part.filter({ project_id }).catch(() => []),
      base44.entities.PurchaseOrder.filter({ project_id }).catch(() => []),
      base44.entities.ProjectContact.filter({ project_id }).catch(() => []),
      base44.entities.ProjectTradeRequirement.filter({ project_id }).catch(() => []),
      base44.entities.Task.filter({ project_id }).catch(() => []),
      base44.entities.ProjectMessage.filter({ project_id }).catch(() => []),
      base44.entities.EmailThread.filter({ project_id }).catch(() => [])
    ]);

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Deduplicate Xero invoices by xero_invoice_id
    const uniqueInvoices = xeroInvoices.reduce((acc, inv) => {
      if (!acc.find(i => i.xero_invoice_id === inv.xero_invoice_id)) {
        acc.push(inv);
      }
      return acc;
    }, []);

    return Response.json({
      project,
      jobs: jobs || [],
      quotes: quotes || [],
      xeroInvoices: uniqueInvoices,
      parts: parts || [],
      purchaseOrders: purchaseOrders || [],
      projectContacts: projectContacts || [],
      tradeRequirements: tradeRequirements || [],
      projectTasks: projectTasks || [],
      projectMessages: projectMessages || [],
      emailThreads: emailThreads || []
    });
  } catch (error) {
    console.error('Error fetching project with relations:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch project data' 
    }, { status: 500 });
  }
});