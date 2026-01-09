import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { filterRestrictedFields } from './shared/permissionHelpers.js';

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
      emailThreads,
      handoverReports,
      customer,
      organisation,
      samples
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
      (async () => {
        const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
        if (!proj?.quote_ids || proj.quote_ids.length === 0) {
          return [];
        }
        // Fetch quotes using project's quote_ids array (source of truth)
        const quotePromises = proj.quote_ids.map(id => 
          base44.asServiceRole.entities.Quote.get(id).catch(err => {
            console.error(`[getProjectWithRelations] Failed to fetch quote ${id}:`, err);
            return null;
          })
        );
        const quotes = await Promise.all(quotePromises);
        return quotes.filter(q => q !== null);
      })(),
      (async () => {
        const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
        if (!proj?.xero_invoices || proj.xero_invoices.length === 0) {
          console.log(`[getProjectWithRelations] No xero_invoices in project array`);
          return [];
        }
        console.log(`[getProjectWithRelations] Fetching ${proj.xero_invoices.length} invoices from project.xero_invoices array`);
        // Fetch invoices using project's xero_invoices array (source of truth)
        const invoicePromises = proj.xero_invoices.map(id => 
          base44.asServiceRole.entities.XeroInvoice.get(id).catch(err => {
            console.error(`[getProjectWithRelations] Failed to fetch invoice ${id}:`, err);
            return null;
          })
        );
        const invoices = await Promise.all(invoicePromises);
        const validInvoices = invoices.filter(inv => inv !== null);
        console.log(`[getProjectWithRelations] Successfully fetched ${validInvoices.length} invoices`);
        return validInvoices;
      })(),
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
      (async () => {
        const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
        const threads = await base44.asServiceRole.entities.EmailThread.filter({ project_id }).catch(err => {
          console.error('[getProjectWithRelations] Failed to fetch email threads:', err);
          return [];
        });
        // If project has primary_email_thread_id, ensure it's included
        if (proj?.primary_email_thread_id && !threads.find(t => t.id === proj.primary_email_thread_id)) {
          const primaryThread = await base44.asServiceRole.entities.EmailThread.get(proj.primary_email_thread_id).catch(() => null);
          if (primaryThread) {
            threads.unshift(primaryThread);
          }
        }
        return threads;
      })(),
      base44.asServiceRole.entities.HandoverReport.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch handover reports:', err);
        return [];
      }),
      // Fetch customer (use get if customer_id exists)
      (async () => {
        const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
        if (proj?.customer_id) {
          return base44.asServiceRole.entities.Customer.get(proj.customer_id).catch(err => {
            console.error('[getProjectWithRelations] Failed to fetch customer:', err);
            return null;
          });
        }
        return null;
      })(),
      // Fetch organisation (use get if organisation_id exists)
      (async () => {
        const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
        if (proj?.organisation_id) {
          return base44.asServiceRole.entities.Organisation.get(proj.organisation_id).catch(err => {
            console.error('[getProjectWithRelations] Failed to fetch organisation:', err);
            return null;
          });
        }
        return null;
      })(),
      base44.asServiceRole.entities.Sample.filter({ project_id }).catch(err => {
        console.error('[getProjectWithRelations] Failed to fetch samples:', err);
        return [];
      })
    ]);

    // CRITICAL: Validate project exists
    if (!project) {
      console.error('[getProjectWithRelations] Project not found:', project_id);
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // CRITICAL: Safely deduplicate Xero invoices
    console.log(`[getProjectWithRelations] Before deduplication - xeroInvoices:`, xeroInvoices);
    const uniqueXeroInvoices = Array.isArray(xeroInvoices) 
      ? xeroInvoices.reduce((acc, inv) => {
          if (inv && inv.xero_invoice_id && !acc.find(i => i.xero_invoice_id === inv.xero_invoice_id)) {
            acc.push(inv);
          }
          return acc;
        }, [])
      : [];
    console.log(`[getProjectWithRelations] After deduplication - uniqueXeroInvoices:`, uniqueXeroInvoices);

    console.log(`[getProjectWithRelations] Successfully fetched project ${project_id}: ${jobs.length} jobs, ${quotes.length} quotes, ${uniqueXeroInvoices.length} invoices, ${handoverReports.length} handover reports, ${samples.length} samples`);
    
    // DEBUG: Log invoice data structure
    if (uniqueXeroInvoices.length > 0) {
      console.log(`[getProjectWithRelations] Xero Invoices for project ${project_id}:`, JSON.stringify(uniqueXeroInvoices.map(inv => ({
        id: inv.id,
        xero_invoice_id: inv.xero_invoice_id,
        xero_invoice_number: inv.xero_invoice_number,
        project_id: inv.project_id,
        status: inv.status
      }))));
    }

    // Filter restricted fields before returning
    const filteredProject = filterRestrictedFields(user, 'Project', project);
    
    // CRITICAL: Always return valid structure with fallback arrays
    return Response.json({
      project: filteredProject,
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
      emailThreads: emailThreads || [],
      handoverReports: handoverReports || [],
      customer: customer || null,
      organisation: organisation || null,
      samples: samples || []
    });

  } catch (error) {
    console.error('[getProjectWithRelations] CRITICAL ERROR:', error);
    return Response.json({ 
      error: 'Failed to fetch project data',
      _debug: error.message 
    }, { status: 500 });
  }
});