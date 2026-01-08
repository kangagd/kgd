import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function refreshAndGetConnection(base44) {
    const connections = await base44.asServiceRole.entities.XeroConnection.list();
    if (connections.length === 0) throw new Error('No Xero connection found');
    
    const connection = connections[0];
    
    // Use the correct field name for tenant ID
    const tenantId = connection.xero_tenant_id || connection.tenant_id;
    if (!tenantId) throw new Error('Xero tenant ID not found in connection');
    
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

        return { ...connection, access_token: tokens.access_token, tenant_id: tenantId };
    }

    return { ...connection, tenant_id: tenantId };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // ADMIN-ONLY: This is a data migration function
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { dry_run = true, limit = 50 } = await req.json();

        console.log('[migrateLegacyInvoiceUrls] Starting migration', { dry_run, limit });

        // Find all projects with legacy invoice URLs (regardless of xero_invoices array)
        const allProjects = await base44.asServiceRole.entities.Project.list();
        console.log(`[migrateLegacyInvoiceUrls] Total projects: ${allProjects.length}`);
        
        const legacyProjects = allProjects.filter(p => {
            const hasLegacyUrl = p.legacy_xero_invoice_url || p.invoice_url;
            const notDeleted = !p.deleted_at;
            return hasLegacyUrl && notDeleted;
        }).slice(0, limit);

        console.log(`[migrateLegacyInvoiceUrls] Projects with legacy URLs: ${legacyProjects.length}`);
        console.log(`[migrateLegacyInvoiceUrls] Processing first ${Math.min(limit, legacyProjects.length)} projects`);

        // Get Xero connection with valid token
        let connection;
        try {
            connection = await refreshAndGetConnection(base44);
            console.log('[migrateLegacyInvoiceUrls] Got Xero connection. Tenant:', connection.tenant_id);
        } catch (error) {
            console.error('[migrateLegacyInvoiceUrls] Error getting Xero credentials:', error);
            return Response.json({ 
                error: `Failed to get Xero credentials: ${error.message}. You may need to reconnect to Xero.` 
            }, { status: 500 });
        }

        const actions = [];
        let invoicesFound = 0;
        let invoicesCreated = 0;
        let invoicesLinked = 0;

        for (const project of legacyProjects) {
            try {
                // Search Xero for invoice matching project number
                const searchQuery = `InvoiceNumber="${project.project_number}"`;
                const searchResponse = await fetch(
                    `https://api.xero.com/api.xro/2.0/Invoices?where=${encodeURIComponent(searchQuery)}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${connection.access_token}`,
                            'xero-tenant-id': connection.tenant_id,
                            'Accept': 'application/json'
                        }
                    }
                );

                if (!searchResponse.ok) {
                    const errorText = await searchResponse.text();
                    console.error(`[Xero API Error] Status: ${searchResponse.status}, Body: ${errorText}`);
                    actions.push({
                        project_id: project.id,
                        project_number: project.project_number,
                        action: 'error',
                        message: `Xero API error: ${searchResponse.status} - ${errorText}`
                    });
                    continue;
                }

                const searchData = await searchResponse.json();
                const xeroInvoices = searchData.Invoices || [];

                if (xeroInvoices.length === 0) {
                    actions.push({
                        project_id: project.id,
                        project_number: project.project_number,
                        action: 'not_found',
                        message: 'No matching invoice in Xero'
                    });
                    continue;
                }

                // Take first matching invoice
                const xeroInvoice = xeroInvoices[0];
                invoicesFound++;

                // Check if XeroInvoice entity already exists
                const existingInvoices = await base44.asServiceRole.entities.XeroInvoice.filter({
                    xero_invoice_id: xeroInvoice.InvoiceID
                });

                let invoiceEntity;
                if (existingInvoices.length > 0) {
                    invoiceEntity = existingInvoices[0];
                    actions.push({
                        project_id: project.id,
                        project_number: project.project_number,
                        invoice_number: xeroInvoice.InvoiceNumber,
                        action: dry_run ? 'would_link_existing' : 'linked_existing',
                        invoice_total: xeroInvoice.Total,
                        invoice_id: invoiceEntity.id
                    });
                } else {
                    // Create new XeroInvoice entity
                    const invoiceData = {
                        xero_invoice_id: xeroInvoice.InvoiceID,
                        xero_invoice_number: xeroInvoice.InvoiceNumber,
                        project_id: project.id,
                        customer_id: project.customer_id,
                        customer_name: project.customer_name,
                        contact_name: xeroInvoice.Contact?.Name || null,
                        reference: xeroInvoice.Reference || null,
                        status: xeroInvoice.Status,
                        total: xeroInvoice.Total,
                        total_amount: xeroInvoice.Total,
                        amount_due: xeroInvoice.AmountDue,
                        amount_paid: xeroInvoice.AmountPaid,
                        date: xeroInvoice.Date,
                        issue_date: xeroInvoice.Date,
                        due_date: xeroInvoice.DueDate,
                        pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${xeroInvoice.InvoiceID}`,
                        online_invoice_url: xeroInvoice.OnlineInvoiceUrl || null,
                        online_payment_url: xeroInvoice.OnlineInvoiceUrl || null,
                        raw_payload: xeroInvoice,
                    };

                    if (!dry_run) {
                        invoiceEntity = await base44.asServiceRole.entities.XeroInvoice.create(invoiceData);
                        invoicesCreated++;
                    }

                    actions.push({
                        project_id: project.id,
                        project_number: project.project_number,
                        invoice_number: xeroInvoice.InvoiceNumber,
                        action: dry_run ? 'would_create_and_link' : 'created_and_linked',
                        invoice_total: xeroInvoice.Total,
                        invoice_id: dry_run ? 'pending' : invoiceEntity.id
                    });
                }

                // Link to project
                if (!dry_run && invoiceEntity) {
                    await base44.asServiceRole.entities.Project.update(project.id, {
                        xero_invoices: [invoiceEntity.id],
                        primary_xero_invoice_id: invoiceEntity.id,
                        xero_payment_url: xeroInvoice.OnlineInvoiceUrl || null
                    });
                    invoicesLinked++;
                }

            } catch (error) {
                console.error(`[migrateLegacyInvoiceUrls] Error processing project ${project.id}:`, error);
                actions.push({
                    project_id: project.id,
                    project_number: project.project_number,
                    action: 'error',
                    message: error.message
                });
            }
        }

        return Response.json({
            dry_run,
            projects_scanned: legacyProjects.length,
            invoices_found: invoicesFound,
            invoices_created: invoicesCreated,
            invoices_linked: invoicesLinked,
            actions,
            summary: dry_run 
                ? `Would create ${invoicesFound} XeroInvoice entities and link to projects`
                : `Created ${invoicesCreated} new XeroInvoice entities, linked ${invoicesLinked} to projects`
        });

    } catch (error) {
        console.error('[migrateLegacyInvoiceUrls] Fatal error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});