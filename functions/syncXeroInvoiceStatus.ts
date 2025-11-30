import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { refreshXeroTokenIfNeeded } from './refreshXeroToken.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Can be called via webhook or manually
    
    // If manual sync requested for specific invoice
    let invoiceIdToSync = null;
    try {
        const body = await req.json();
        invoiceIdToSync = body.xero_invoice_id;
    } catch (e) {}

    const connection = await refreshXeroTokenIfNeeded(base44);

    // If specific ID, sync just that one
    if (invoiceIdToSync) {
        const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${invoiceIdToSync}`, {
            headers: {
                'Authorization': `Bearer ${connection.access_token}`,
                'xero-tenant-id': connection.xero_tenant_id,
                'Accept': 'application/json'
            }
        });
        
        if (res.ok) {
            const data = await res.json();
            const inv = data.Invoices[0];
            await updateLocalInvoice(base44, inv);
            return Response.json({ success: true, invoice: inv });
        }
    }

    // Bulk sync (recent changes) - simpler for now: fetch all AUTHORISED/SENT invoices from DB and update them
    // Or fetch from Xero modified since last sync.
    // Let's fetch active local invoices and update them.
    const activeInvoices = await base44.asServiceRole.entities.XeroInvoice.list(); 
    // In a real app, filter for non-PAID/VOIDED to reduce load, but schema filtering is limited here so getting list.
    
    const unresolved = activeInvoices.filter(i => i.status !== 'PAID' && i.status !== 'VOIDED');
    
    let updatedCount = 0;
    
    // Batch them if possible, Xero supports IDs filter
    // For now, just iterate (limit to 10 most recent for performance if many)
    for (const localInv of unresolved.slice(0, 10)) {
        const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${localInv.xero_invoice_id}`, {
            headers: {
                'Authorization': `Bearer ${connection.access_token}`,
                'xero-tenant-id': connection.xero_tenant_id,
                'Accept': 'application/json'
            }
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.Invoices && data.Invoices.length > 0) {
                await updateLocalInvoice(base44, data.Invoices[0]);
                updatedCount++;
            }
        }
    }

    return Response.json({ success: true, updated: updatedCount });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function updateLocalInvoice(base44, xeroInv) {
    // Find local record
    const local = await base44.asServiceRole.entities.XeroInvoice.filter({ xero_invoice_id: xeroInv.InvoiceID });
    if (local.length === 0) return;

    const updates = {
        status: xeroInv.Status,
        amount_due: xeroInv.AmountDue,
        amount_paid: xeroInv.AmountPaid,
        total: xeroInv.Total,
        paid_at: xeroInv.FullyPaidOnDate ? new Date(xeroInv.FullyPaidOnDate).toISOString() : null
    };

    // If online URL missing, try fetch
    if (!local[0].xero_public_url) {
        // logic to fetch online url could go here
    }

    await base44.asServiceRole.entities.XeroInvoice.update(local[0].id, updates);
}