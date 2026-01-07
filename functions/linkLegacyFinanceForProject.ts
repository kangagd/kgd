import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
const PANDADOC_API_URL = "https://api.pandadoc.com/public/v1";

// Helper to get Xero connection
async function refreshAndGetConnection(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  if (connections.length === 0) throw new Error('No Xero connection found');
  
  const connection = connections[0];
  const expiresAt = new Date(connection.expires_at);
  
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token
      })
    });

    if (!tokenResponse.ok) throw new Error('Token refresh failed');
    
    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    });

    return { ...connection, access_token: tokens.access_token };
  }

  return connection;
}

// Helper to parse Xero date
const parseXeroDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const msMatch = dateStr.match(/\/Date\((\d+)\)/);
    if (msMatch) {
      const ms = parseInt(msMatch[1], 10);
      return new Date(ms).toISOString().split('T')[0];
    }
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    const testDate = new Date(dateStr);
    if (!isNaN(testDate.getTime())) return dateStr;
    return null;
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    // Load project
    const project = await base44.entities.Project.get(project_id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const updates = {};
    let linkedQuote = null;
    let linkedInvoice = null;

    // ---------------------------------------------------------
    // 1. PandaDoc Linking
    // ---------------------------------------------------------
    if (project.legacy_pandadoc_url && !project.primary_quote_id) {
      // Try to extract ID (looking for standard 24-char ID or similar from URL)
      // Common patterns: .../documents/dH5S... or similar
      const pdMatch = project.legacy_pandadoc_url.match(/documents\/([a-zA-Z0-9]+)/);
      const pdId = pdMatch ? pdMatch[1] : null;

      if (pdId) {
        console.log(`Found PandaDoc ID: ${pdId}`);
        
        // Check existing
        const existingQuotes = await base44.entities.Quote.filter({ pandadoc_document_id: pdId });
        
        if (existingQuotes.length > 0) {
          updates.primary_quote_id = existingQuotes[0].id;
          linkedQuote = existingQuotes[0];
        } else if (PANDADOC_API_KEY) {
          // Fetch from PandaDoc
          const pdRes = await fetch(`${PANDADOC_API_URL}/documents/${pdId}`, {
             headers: { 'Authorization': `API-Key ${PANDADOC_API_KEY}` }
          });

          if (pdRes.ok) {
            const pdDoc = await pdRes.json();
            
            // Fetch details for public link
            let publicUrl = '';
            try {
               const sessionRes = await fetch(`${PANDADOC_API_URL}/documents/${pdId}/session`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `API-Key ${PANDADOC_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    recipient: pdDoc.recipients?.[0]?.email || '',
                    lifetime: 31536000
                  })
               });
               if (sessionRes.ok) {
                 const sessionData = await sessionRes.json();
                 publicUrl = sessionData.id ? `https://app.pandadoc.com/s/${sessionData.id}` : '';
               }
            } catch (e) { console.error('PD session error', e); }

            // Calculate value
            let value = 0;
            if (pdDoc.grand_total?.amount) {
               value = parseFloat(pdDoc.grand_total.amount) || 0;
            }

            // Create Quote
            const statusMap = {
              'document.draft': 'Draft', 'document.sent': 'Sent', 'document.viewed': 'Viewed',
              'document.completed': 'Accepted', 'document.voided': 'Declined', 'document.declined': 'Declined',
              'document.expired': 'Expired'
            };

            const newQuote = await base44.entities.Quote.create({
              project_id: project.id,
              customer_id: project.customer_id,
              name: pdDoc.name || project.title,
              value: value,
              currency: pdDoc.grand_total?.currency || 'AUD',
              pandadoc_document_id: pdDoc.id,
              pandadoc_public_url: publicUrl,
              pandadoc_internal_url: `https://app.pandadoc.com/a/#/documents/${pdDoc.id}`,
              status: statusMap[pdDoc.status] || 'Draft',
              sent_at: pdDoc.date_sent || null,
              customer_name: project.customer_name,
              customer_email: project.customer_email
            });

            updates.primary_quote_id = newQuote.id;
            linkedQuote = newQuote;
          }
        }
      }
    }

    // ---------------------------------------------------------
    // 2. Xero Linking
    // ---------------------------------------------------------
    if (project.legacy_xero_invoice_url && !project.primary_xero_invoice_id) {
      // Extract UUID
      const uuidMatch = project.legacy_xero_invoice_url.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
      const xeroId = uuidMatch ? uuidMatch[0] : null;

      if (xeroId) {
        console.log(`Found Xero ID: ${xeroId}`);
        
        // Check existing
        const existingInvoices = await base44.entities.XeroInvoice.filter({ xero_invoice_id: xeroId });
        
        if (existingInvoices.length > 0) {
          updates.primary_xero_invoice_id = existingInvoices[0].id;
          linkedInvoice = existingInvoices[0];
        } else {
          // Fetch from Xero
          try {
            const connection = await refreshAndGetConnection(base44);
            const xeroRes = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${xeroId}`, {
              headers: {
                'Authorization': `Bearer ${connection.access_token}`,
                'xero-tenant-id': connection.xero_tenant_id,
                'Accept': 'application/json'
              }
            });

            if (xeroRes.ok) {
              const xeroData = await xeroRes.json();
              const inv = xeroData.Invoices?.[0];
              
              if (inv) {
                // Create XeroInvoice entity
                const newInvoice = await base44.entities.XeroInvoice.create({
                  xero_invoice_id: inv.InvoiceID,
                  xero_invoice_number: inv.InvoiceNumber,
                  project_id: project.id,
                  customer_id: project.customer_id,
                  contact_name: inv.Contact?.Name,
                  reference: inv.Reference,
                  status: inv.Status,
                  total: inv.Total,
                  total_amount: inv.Total,
                  amount_due: inv.AmountDue,
                  amount_paid: inv.AmountPaid,
                  date: parseXeroDate(inv.Date),
                  due_date: parseXeroDate(inv.DueDate),
                  online_payment_url: inv.OnlineInvoices?.OnlineInvoiceUrl || null,
                  online_invoice_url: inv.OnlineInvoices?.OnlineInvoiceUrl || null,
                  created_by_user_id: user.id
                });

                updates.primary_xero_invoice_id = newInvoice.id;
                linkedInvoice = newInvoice;
              }
            }
          } catch (xeroErr) {
            console.error('Xero link error', xeroErr);
          }
        }
      }
    }

    // ---------------------------------------------------------
    // 3. Update Project
    // ---------------------------------------------------------
    if (Object.keys(updates).length > 0) {
      await base44.entities.Project.update(project.id, updates);
    }

    return Response.json({
      success: true,
      updated: Object.keys(updates).length > 0,
      updates,
      linkedQuote,
      linkedInvoice
    });

  } catch (error) {
    console.error('linkLegacyFinanceForProject error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});