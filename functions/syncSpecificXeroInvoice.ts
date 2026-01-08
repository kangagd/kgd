import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to refresh token if needed
async function refreshXeroTokenIfNeeded(base44) {
    const connections = await base44.asServiceRole.entities.XeroConnection.list();
    if (!connections || connections.length === 0) {
        throw new Error('No Xero connection found');
    }

    const connection = connections[0];
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const minutesUntilExpiry = (expiresAt - now) / (1000 * 60);

    if (minutesUntilExpiry < 10) {
        const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: connection.refresh_token,
                client_id: Deno.env.get('XERO_CLIENT_ID'),
                client_secret: Deno.env.get('XERO_CLIENT_SECRET')
            })
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to refresh Xero token');
        }

        const tokens = await tokenResponse.json();
        const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: newExpiresAt.toISOString()
        });

        return { ...connection, access_token: tokens.access_token };
    }

    return connection;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { invoiceNumber } = await req.json();
        
        if (!invoiceNumber) {
            return Response.json({ error: 'invoiceNumber is required' }, { status: 400 });
        }

        console.log(`[syncSpecificXeroInvoice] Syncing invoice: ${invoiceNumber}`);

        // Get Xero connection
        const connection = await refreshXeroTokenIfNeeded(base44);

        // Search for the invoice in Xero
        const xeroResponse = await fetch(
            `https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber="${invoiceNumber}"`,
            {
                headers: {
                    'Authorization': `Bearer ${connection.access_token}`,
                    'xero-tenant-id': connection.tenant_id,
                    'Accept': 'application/json'
                }
            }
        );

        if (!xeroResponse.ok) {
            throw new Error(`Xero API error: ${xeroResponse.status} ${xeroResponse.statusText}`);
        }

        const xeroData = await xeroResponse.json();

        if (!xeroData.Invoices || xeroData.Invoices.length === 0) {
            return Response.json({ 
                error: 'Invoice not found in Xero',
                invoiceNumber 
            }, { status: 404 });
        }

        const invoice = xeroData.Invoices[0];
        console.log(`[syncSpecificXeroInvoice] Found invoice in Xero:`, invoice.InvoiceID);

        // Check if invoice already exists locally
        const existing = await base44.asServiceRole.entities.XeroInvoice.filter({
            xero_invoice_id: invoice.InvoiceID
        });

        const invoiceData = {
            xero_invoice_id: invoice.InvoiceID,
            xero_invoice_number: invoice.InvoiceNumber,
            contact_name: invoice.Contact?.Name,
            reference: invoice.Reference,
            status: invoice.Status,
            total: invoice.Total,
            total_amount: invoice.Total,
            amount_due: invoice.AmountDue || 0,
            amount_paid: invoice.AmountPaid || 0,
            issue_date: invoice.DateString?.split('T')[0] || null,
            due_date: invoice.DueDateString?.split('T')[0] || null,
            credit_notes_total: invoice.CreditNotes?.reduce((sum, cn) => sum + (cn.Total || 0), 0) || 0,
            last_payment_date: invoice.Payments?.[0]?.Date || null,
            online_invoice_url: invoice.OnlineInvoiceUrl || null,
            online_payment_url: invoice.OnlineInvoiceUrl || null,
            raw_payload: invoice
        };

        let result;
        if (existing.length > 0) {
            // Update existing
            await base44.asServiceRole.entities.XeroInvoice.update(existing[0].id, invoiceData);
            result = { action: 'updated', invoiceId: existing[0].id };
            console.log(`[syncSpecificXeroInvoice] Updated existing invoice`);
        } else {
            // Create new
            const created = await base44.asServiceRole.entities.XeroInvoice.create(invoiceData);
            result = { action: 'created', invoiceId: created.id };
            console.log(`[syncSpecificXeroInvoice] Created new invoice`);
        }

        return Response.json({
            success: true,
            invoiceNumber,
            xeroInvoiceId: invoice.InvoiceID,
            ...result
        });

    } catch (error) {
        console.error('[syncSpecificXeroInvoice] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});