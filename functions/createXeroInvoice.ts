import { createClientFromRequest } from './shared/sdk.js';
import { updateProjectActivity } from './updateProjectActivity.js';
import { normalizeParams } from './shared/parameterNormalizer.js';
import { refreshAndGetXeroConnection, getXeroHeaders } from './shared/xeroHelpers.js';

async function createXeroInvoice(base44, invoicePayload) {
  const connection = await refreshAndGetXeroConnection(base44);

  const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    method: 'POST',
    headers: getXeroHeaders(connection),
    body: JSON.stringify(invoicePayload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Xero API error: ${error}`);
  }

  const result = await response.json();
  const invoice = result.Invoices[0];

  return {
    xero_invoice_id: invoice.InvoiceID,
    xero_invoice_number: invoice.InvoiceNumber,
    status: invoice.Status,
    total: invoice.Total,
    total_amount: invoice.Total,
    amount_due: invoice.AmountDue,
    amount_paid: invoice.AmountPaid || 0,
    date: invoice.Date,
    issue_date: invoice.Date,
    due_date: invoice.DueDate,
    pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoice.InvoiceID}`
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admin and manager roles
    const isAuthorized = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden - Admin or Manager access required' }, { status: 403 });
    }

    const body = await req.json();
    const { project_id } = normalizeParams(body);
    let { invoicePayload } = body;
    
    // Process line items to include SKU in ItemCode field for Xero
    // GUARDRAIL: Xero truncates ItemCode to 30 characters, so we truncate here to match
    if (invoicePayload.LineItems) {
      invoicePayload.LineItems = invoicePayload.LineItems.map(item => {
        const sku = item.ItemCode || item.sku || "";
        return {
          ...item,
          ItemCode: sku.substring(0, 30), // Truncate to 30 chars to match Xero's limit
        };
      });
    }
    
    const result = await createXeroInvoice(base44, invoicePayload);

    // Update project activity if linked to a project
    if (project_id) {
      await updateProjectActivity(base44, project_id, 'Invoice Created');
    }

    return Response.json(result);

  } catch (error) {
    console.error('Create invoice error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export { createXeroInvoice };