import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

import { refreshAndGetXeroConnection, getXeroHeaders, xeroFetchWithRetry } from './shared/xeroHelpers.js';

// Batch sync all Xero invoice statuses - scheduled task
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY: This is a scheduled task or admin-triggered sync
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[batchSyncXeroInvoices] Starting sync...');

    const connection = await refreshAndGetXeroConnection(base44);

    // Get all XeroInvoice records that aren't VOIDED (limit to 50 per run)
    const allInvoices = await base44.asServiceRole.entities.XeroInvoice.list('-updated_date', 50);
    const activeInvoices = allInvoices.filter(inv => inv.status !== 'VOIDED');

    console.log(`[batchSyncXeroInvoices] Found ${activeInvoices.length} active invoices to sync`);

    let updated = 0;
    let errors = 0;
    let skipped = 0;

    for (const invoiceRecord of activeInvoices) {
      try {
        // Rate limiting: reduced delay to 100ms to avoid timeout
        await new Promise(resolve => setTimeout(resolve, 100));

        // Fetch latest invoice data from Xero
        const xeroResponse = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices/${invoiceRecord.xero_invoice_id}`,
          {
            headers: getXeroHeaders(connection)
          }
        );

        if (!xeroResponse.ok) {
          console.error(`Failed to fetch invoice ${invoiceRecord.xero_invoice_id}: ${xeroResponse.status}`);
          errors++;
          continue;
        }

        const xeroResult = await xeroResponse.json();
        const xeroInvoice = xeroResult.Invoices[0];

        // If voided, handle separately
        if (xeroInvoice.Status === 'VOIDED') {
          if (invoiceRecord.job_id) {
            await base44.asServiceRole.entities.Job.update(invoiceRecord.job_id, {
              xero_invoice_id: null,
              xero_payment_url: null
            });
          }
          if (invoiceRecord.project_id) {
            const project = await base44.asServiceRole.entities.Project.get(invoiceRecord.project_id);
            if (project?.xero_payment_url) {
              await base44.asServiceRole.entities.Project.update(invoiceRecord.project_id, {
                xero_payment_url: null
              });
            }
          }
          await base44.asServiceRole.entities.XeroInvoice.delete(invoiceRecord.id);
          console.log(`Voided invoice ${invoiceRecord.xero_invoice_number}`);
          updated++;
          continue;
        }

        // Determine if overdue
        let finalStatus = xeroInvoice.Status;
        if (xeroInvoice.DueDate && xeroInvoice.AmountDue > 0) {
          const dueDate = new Date(xeroInvoice.DueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (dueDate < today && xeroInvoice.Status !== 'PAID') {
            finalStatus = 'OVERDUE';
          }
        }

        // Extract last payment date
        let lastPaymentDate = null;
        if (xeroInvoice.Payments && xeroInvoice.Payments.length > 0) {
          const sortedPayments = xeroInvoice.Payments.sort((a, b) => 
            new Date(b.Date) - new Date(a.Date)
          );
          lastPaymentDate = sortedPayments[0].Date;
        }

        // Calculate credit notes total
        let creditNotesTotal = 0;
        if (xeroInvoice.CreditNotes && xeroInvoice.CreditNotes.length > 0) {
          creditNotesTotal = xeroInvoice.CreditNotes.reduce((sum, cn) => sum + (cn.Total || 0), 0);
        }

        // Fetch online payment URL
        let onlinePaymentUrl = null;
        try {
          const onlineInvoiceResponse = await fetch(
            `https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoice.InvoiceID}/OnlineInvoice`,
            {
              headers: getXeroHeaders(connection)
            }
          );

          if (onlineInvoiceResponse.ok) {
            const onlineInvoiceResult = await onlineInvoiceResponse.json();
            onlinePaymentUrl = onlineInvoiceResult.OnlineInvoices?.[0]?.OnlineInvoiceUrl || null;
          }
        } catch (err) {
          console.warn(`Failed to fetch online URL for ${invoiceRecord.xero_invoice_number}`);
        }

        // Check financial locking
        const updateData = {
          status: finalStatus,
          payment_terms: xeroInvoice.Terms || null,
          credit_notes_total: creditNotesTotal,
          last_payment_date: lastPaymentDate,
          online_payment_url: onlinePaymentUrl,
          online_invoice_url: onlinePaymentUrl,
          raw_payload: xeroInvoice
        };

        let canUpdateAmounts = true;
        if (invoiceRecord.project_id) {
          const project = await base44.asServiceRole.entities.Project.get(invoiceRecord.project_id);
          if (project?.financial_value_locked) {
            canUpdateAmounts = false;
          }
        }

        if (canUpdateAmounts) {
          updateData.total_amount = xeroInvoice.Total;
          updateData.amount_due = xeroInvoice.AmountDue;
          updateData.amount_paid = xeroInvoice.AmountPaid || 0;
        }

        await base44.asServiceRole.entities.XeroInvoice.update(invoiceRecord.id, updateData);

        // Update payment URLs on linked records
        if (invoiceRecord.job_id) {
          await base44.asServiceRole.entities.Job.update(invoiceRecord.job_id, {
            xero_payment_url: onlinePaymentUrl
          });
        }

        if (invoiceRecord.project_id) {
          await base44.asServiceRole.entities.Project.update(invoiceRecord.project_id, {
            xero_payment_url: onlinePaymentUrl
          });
        }

        updated++;
      } catch (error) {
        console.error(`Error syncing invoice ${invoiceRecord.xero_invoice_number}:`, error.message);
        errors++;
      }
    }

    console.log(`[batchSyncXeroInvoices] Complete: ${updated} updated, ${errors} errors`);

    return Response.json({
      success: true,
      invoices_synced: updated,
      errors: errors,
      total: activeInvoices.length
    });

  } catch (error) {
    console.error('[batchSyncXeroInvoices] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});