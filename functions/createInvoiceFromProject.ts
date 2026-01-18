import { createClientFromRequest } from './shared/sdk.js';
import { normalizeParams } from './shared/parameterNormalizer.js';
import { refreshAndGetXeroConnection, getXeroHeaders } from './shared/xeroHelpers.js';

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
    const { lineItems, total } = body;

    // Normalize line item fields (handle camelCase, snake_case, capitalized variants)
    const normalizeLineItem = (item) => {
      const quantityRaw = item.quantity ?? item.qty ?? item.Quantity ?? 1;
      const amountRaw = item.amount ?? item.unit_amount ?? item.UnitAmount ?? 0;
      
      return {
        description: item.description ?? item.Description ?? "",
        quantity: Number(quantityRaw) || 1,
        amount: Number(amountRaw) || 0,
        price_list_item_id: item.price_list_item_id ?? item.priceListItemId ?? null,
        sku: item.sku ?? item.SKU ?? item.ItemCode ?? "",
        discount_amount: Number(item.discount_amount ?? item.discount ?? item.DiscountAmount ?? 0) || 0,
        discount_rate: Number(item.discount_rate ?? item.discountRate ?? item.DiscountRate ?? 0) || 0
      };
    };

    const normalizedItems = (lineItems || []).map(normalizeLineItem);

    // Fetch project
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch customer
    const customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get Xero settings for account codes - default to 200 (Sales)
    const xeroSettings = await base44.asServiceRole.entities.XeroSettings.list();
    const accountCode = (xeroSettings.length > 0 && xeroSettings[0].default_sales_account_code) 
      ? xeroSettings[0].default_sales_account_code 
      : "200";

    // Fetch price list items for SKU/ItemCode mapping
    const itemIds = normalizedItems.filter(item => item.price_list_item_id).map(item => item.price_list_item_id);
    const priceListItems = itemIds.length > 0 
      ? await base44.asServiceRole.entities.PriceListItem.filter({ id: { $in: itemIds } })
      : [];
    
    const skuMap = {};
    priceListItems.forEach(pli => {
      skuMap[pli.id] = pli.sku;
    });

    // Build Xero invoice payload with SKU linking
    const xeroLineItems = normalizedItems.map(n => {
      const lineItem = {
        Description: n.description,
        Quantity: n.quantity,
        UnitAmount: n.amount,
        AccountCode: accountCode,
        TaxType: "OUTPUT" // GST on Output (10%)
      };

      // Link to Xero item by SKU: prefer price list, fallback to manual SKU (truncate to 30 chars)
      const itemCode = skuMap[n.price_list_item_id] || n.sku || "";
      if (itemCode) {
        lineItem.ItemCode = String(itemCode).substring(0, 30);
      }

      // Discount mapping (guardrailed - never set both)
      if (n.discount_rate > 0) {
        lineItem.DiscountRate = n.discount_rate;
      } else if (n.discount_amount > 0) {
        lineItem.DiscountAmount = n.discount_amount;
      }

      return lineItem;
    });

    const invoicePayload = {
      Type: "ACCREC",
      Contact: {
        Name: customer.name,
        EmailAddress: customer.email || "",
        Phones: customer.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: customer.phone }] : []
      },
      Date: new Date().toISOString().split('T')[0],
      DueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      LineItems: xeroLineItems,
      InvoiceNumber: String(project.project_number),
      Reference: project.address_full || project.address || `Project #${project.project_number}`,
      Status: "AUTHORISED"
    };

    // STEP 1: Create invoice in Xero FIRST (before any DB writes)
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
    console.log(`[createInvoiceFromProject] Created invoice in Xero: ${invoice.InvoiceID}`);

    // STEP 2: Create or update XeroInvoice record in database
    // GUARDRAIL: Check if batch sync already created this invoice to prevent ghost links
    const existingInvoices = await base44.asServiceRole.entities.XeroInvoice.filter({
      xero_invoice_id: invoice.InvoiceID
    });

    let xeroInvoice;
    const invoiceData = {
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      project_id: project.id,
      customer_id: project.customer_id,
      customer_name: customer.name,
      contact_name: customer.name,
      status: invoice.Status,
      total: invoice.Total,
      total_amount: invoice.Total,
      amount_due: invoice.AmountDue,
      amount_paid: invoice.AmountPaid,
      date: invoice.Date,
      due_date: invoice.DueDate,
      issue_date: invoice.Date,
      pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoice.InvoiceID}`,
      online_payment_url: invoice.OnlineInvoiceUrl || null,
      reference: `Project #${project.project_number} - ${project.title}`,
      raw_payload: invoice
    };

    if (existingInvoices.length > 0) {
      // Update existing record with project_id (fixes ghost link if batch sync created it)
      xeroInvoice = await base44.asServiceRole.entities.XeroInvoice.update(
        existingInvoices[0].id,
        invoiceData
      );
      console.log(`[createInvoiceFromProject] Updated existing XeroInvoice record: ${xeroInvoice.id}`);
    } else {
      // Create new record
      xeroInvoice = await base44.asServiceRole.entities.XeroInvoice.create(invoiceData);
      console.log(`[createInvoiceFromProject] Created XeroInvoice record: ${xeroInvoice.id}`);
    }

    // STEP 3: Link invoice to project (non-critical; if fails, invoice exists in Xero)
    try {
      const xeroInvoices = project.xero_invoices || [];
      if (!xeroInvoices.includes(xeroInvoice.id)) {
        xeroInvoices.push(xeroInvoice.id);
      }
      
      await base44.asServiceRole.entities.Project.update(project.id, {
        xero_invoices: xeroInvoices,
        primary_xero_invoice_id: xeroInvoice.id,
        xero_payment_url: invoice.OnlineInvoiceUrl || null,
        last_activity_at: new Date().toISOString(),
        last_activity_type: 'Invoice Created'
      });
      console.log(`[createInvoiceFromProject] Linked invoice to project ${project_id}`);
    } catch (projectError) {
      // Non-critical failure: invoice exists in Xero and DB, just not linked to project yet
      console.error(`[createInvoiceFromProject] Warning: Failed to link invoice to project (recoverable):`, projectError);
      // Return success anyway—user can manually link via ProjectDetails
    }

    return Response.json({ 
      success: true, 
      xero_invoice_id: invoice.InvoiceID,
      xero_invoice_number: invoice.InvoiceNumber,
      total: invoice.Total,
      pdf_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoice.InvoiceID}`
    });

  } catch (error) {
    console.error('Create invoice from project error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});