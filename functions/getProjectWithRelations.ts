import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { filterRestrictedFields } from './shared/permissionHelpers.js';

// Sanitize sensitive fields from objects to prevent token/credential leakage
const SENSITIVE_FIELD_PATTERNS = [
  'token',
  'refresh_token',
  'access_token',
  'password',
  'secret',
  'api_key',
  'apikey',
  'gmail_access_token',
  'gmail_refresh_token',
  'xero_access_token',
  'xero_refresh_token',
  'oauth_token',
  'bearer_token'
];

const isSensitiveField = (fieldName) => {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some(pattern => 
    lowerField.includes(pattern)
  );
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      // Skip sensitive fields
      continue;
    }
    // Recursively sanitize nested objects
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const sanitizeProjectRelations = (payload) => {
  return {
    project: sanitizeObject(payload.project),
    jobs: sanitizeObject(payload.jobs),
    quotes: sanitizeObject(payload.quotes),
    xeroInvoices: sanitizeObject(payload.xeroInvoices),
    parts: sanitizeObject(payload.parts),
    purchaseOrders: sanitizeObject(payload.purchaseOrders),
    projectContacts: sanitizeObject(payload.projectContacts),
    tradeRequirements: sanitizeObject(payload.tradeRequirements),
    projectTasks: sanitizeObject(payload.projectTasks),
    projectMessages: sanitizeObject(payload.projectMessages),
    projectEmails: sanitizeObject(payload.projectEmails),
    emailThreads: sanitizeObject(payload.emailThreads),
    handoverReports: sanitizeObject(payload.handoverReports),
    customer: sanitizeObject(payload.customer),
    organisation: sanitizeObject(payload.organisation),
    samples: sanitizeObject(payload.samples)
  };
};

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
        try {
          // CANONICAL: Try filter by project_id first
          let quotes = await base44.asServiceRole.entities.Quote.filter({ 
            project_id, 
            deleted_at: { $exists: false } 
          }).catch(err => {
            console.error('[getProjectWithRelations] Failed to filter quotes by project_id:', err);
            return [];
          });

          // FALLBACK: If no quotes found via filter, try project's quote_ids array
          if (!quotes || quotes.length === 0) {
            const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
            if (proj?.quote_ids && proj.quote_ids.length > 0) {
              console.log(`[getProjectWithRelations] No quotes via filter, falling back to ${proj.quote_ids.length} quote IDs from project`);
              const quotePromises = proj.quote_ids.map(id => 
                base44.asServiceRole.entities.Quote.get(id).catch(err => {
                  console.error(`[getProjectWithRelations] Failed to fetch quote ${id}:`, err);
                  return null;
                })
              );
              const fetchedQuotes = await Promise.all(quotePromises);
              quotes = fetchedQuotes.filter(q => q !== null && !q.deleted_at);
            }
          }

          return Array.isArray(quotes) ? quotes : [];
        } catch (err) {
          console.error('[getProjectWithRelations] Failed to fetch quotes:', err);
          return [];
        }
      })(),
      (async () => {
        try {
          // CANONICAL: Try filter by project_id first
          let invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ 
            project_id, 
            deleted_at: { $exists: false } 
          }).catch(err => {
            console.error('[getProjectWithRelations] Failed to filter invoices by project_id:', err);
            return [];
          });

          // FALLBACK: If no invoices found via filter, try project's xero_invoices array
          if (!invoices || invoices.length === 0) {
            const proj = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
            if (proj?.xero_invoices && proj.xero_invoices.length > 0) {
              console.log(`[getProjectWithRelations] No invoices via filter, falling back to ${proj.xero_invoices.length} invoice IDs from project`);
              const invoicePromises = proj.xero_invoices.map(id => 
                base44.asServiceRole.entities.XeroInvoice.get(id).catch(err => {
                  console.error(`[getProjectWithRelations] Failed to fetch invoice ${id}:`, err);
                  return null;
                })
              );
              const fetchedInvoices = await Promise.all(invoicePromises);
              invoices = fetchedInvoices.filter(inv => inv !== null && !inv.deleted_at);
            }
          }

          return Array.isArray(invoices) ? invoices : [];
        } catch (err) {
          console.error('[getProjectWithRelations] Failed to fetch invoices:', err);
          return [];
        }
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
    
    // CRITICAL: Build response payload
    const payload = {
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
    };

    // CRITICAL: Sanitize sensitive fields before returning to frontend
    const sanitizedPayload = sanitizeProjectRelations(payload);
    
    return Response.json(sanitizedPayload);

  } catch (error) {
    console.error('[getProjectWithRelations] CRITICAL ERROR:', error);
    return Response.json({ 
      error: 'Failed to fetch project data',
      _debug: error.message 
    }, { status: 500 });
  }
});