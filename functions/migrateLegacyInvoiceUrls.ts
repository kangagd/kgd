import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // Find all projects with legacy invoice_url but empty xero_invoices array
        const allProjects = await base44.asServiceRole.entities.Project.list();
        const legacyProjects = allProjects.filter(p => 
            p.invoice_url && 
            (!p.xero_invoices || p.xero_invoices.length === 0) &&
            !p.deleted_at
        ).slice(0, limit);

        console.log(`[migrateLegacyInvoiceUrls] Found ${legacyProjects.length} projects with legacy invoice URLs`);

        // Get Xero connection details (access token and tenant ID)
        let xeroAccessToken;
        let xeroTenantId;
        try {
            // Fetch tenant ID from XeroConnection entity
            const xeroConnections = await base44.asServiceRole.entities.XeroConnection.list();
            if (xeroConnections.length === 0) {
                return Response.json({ 
                    error: 'No Xero connection found. Please connect to Xero first.' 
                }, { status: 400 });
            }
            
            const xeroConnection = xeroConnections[0];
            xeroTenantId = xeroConnection.tenant_id;
            
            // ALWAYS refresh token to ensure it's valid
            console.log('[migrateLegacyInvoiceUrls] Refreshing Xero token...');
            const refreshResponse = await base44.asServiceRole.functions.invoke('refreshXeroToken');
            
            if (refreshResponse.data?.error) {
                return Response.json({ 
                    error: `Xero token refresh failed: ${refreshResponse.data.error}. Please reconnect to Xero.` 
                }, { status: 401 });
            }
            
            xeroAccessToken = refreshResponse.data.access_token;
            console.log('[migrateLegacyInvoiceUrls] Token refreshed successfully. Tenant:', xeroTenantId);
            
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
                            'Authorization': `Bearer ${xeroAccessToken}`,
                            'xero-tenant-id': xeroTenantId,
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