import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // CRITICAL: Validate request method
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    
    // CRITICAL: Authentication check
    const user = await base44.auth.me();
    if (!user || !user.email) {
      console.error('[getProjectWithRelations] Authentication failed');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id } = await req.json();
    
    // CRITICAL: Validate project_id
    if (!project_id || typeof project_id !== 'string') {
      console.error('[getProjectWithRelations] Invalid project_id:', project_id);
      return Response.json({ error: 'Valid project_id is required' }, { status: 400 });
    }

    console.log(`[getProjectWithRelations] Fetching project ${project_id} for user ${user.email}`);

    // CRITICAL: Fetch all data in parallel with error handling per entity
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
      base44.asServiceRole.entities.Project.get(project_id).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch project:', err);
        return null;
      }),
      base44.asServiceRole.entities.Job.filter({ project_id }).then(jobs => 
        Array.isArray(jobs) ? jobs.filter(j => j && !j.deleted_at) : []
      ).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch jobs:', err);
        return [];
      }),
      base44.asServiceRole.entities.Quote.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch quotes:', err);
        return [];
      }),
      base44.asServiceRole.entities.XeroInvoice.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch xero invoices:', err);
        return [];
      }),
      base44.asServiceRole.entities.Part.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch parts:', err);
        return [];
      }),
      base44.asServiceRole.entities.PurchaseOrder.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch purchase orders:', err);
        return [];
      }),
      base44.asServiceRole.entities.ProjectContact.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch project contacts:', err);
        return [];
      }),
      base44.asServiceRole.entities.ProjectTradeRequirement.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch trade requirements:', err);
        return [];
      }),
      base44.asServiceRole.entities.Task.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch tasks:', err);
        return [];
      }),
      base44.asServiceRole.entities.ProjectMessage.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch messages:', err);
        return [];
      }),
      base44.asServiceRole.entities.ProjectEmail.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch project emails:', err);
        return [];
      }),
      base44.asServiceRole.entities.EmailThread.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch email threads:', err);
        return [];
      })
    ]);

    // CRITICAL: Validate project exists
    if (!project) {
      console.error('[getProjectWithRelations] Project not found:', project_id);
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // CRITICAL: Safely deduplicate Xero invoices
    const uniqueXeroInvoices = Array.isArray(xeroInvoices) 
      ? xeroInvoices.reduce((acc, inv) => {
          if (inv && inv.xero_invoice_id && !acc.find(i => i.xero_invoice_id === inv.xero_invoice_id)) {
            acc.push(inv);
          }
          return acc;
        }, [])
      : [];

    console.log(`[getProjectWithRelations] Successfully fetched project ${project_id}: ${jobs.length} jobs, ${quotes.length} quotes, ${uniqueXeroInvoices.length} invoices`);

    // CRITICAL: Always return valid structure with fallback arrays
    return Response.json({
      project,
      jobs: jobs || [],
      quotes: quotes || [],
      xeroInvoices: uniqueXeroInvoices || [],
      parts: parts || [],
      purchaseOrders: purchaseOrders || [],
      projectContacts: projectContacts || [],
      tradeRequirements: tradeRequirements || [],
      projectTasks: projectTasks || [],
      projectMessages: projectMessages || [],
      projectEmails: projectEmails || [],
      emailThreads: emailThreads || []
    });

  } catch (error) {
    console.error('[getProjectWithRelations] CRITICAL ERROR:', error);
    return Response.json({ 
      error: 'Failed to fetch project data',
      _debug: error.message 
    }, { status: 500 });
  }
});