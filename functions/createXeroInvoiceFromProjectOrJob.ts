import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { refreshXeroTokenIfNeeded } from './refreshXeroToken.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { projectId, jobId, lineItems, date, dueDate } = await req.json();

    if (!projectId && !jobId) {
      return Response.json({ error: 'Project ID or Job ID required' }, { status: 400 });
    }

    // 1. Fetch Context (Project/Job/Customer)
    let project = null;
    let job = null;
    let customer = null;
    let reference = '';

    if (projectId) {
      project = await base44.entities.Project.get(projectId);
      if (!project) throw new Error('Project not found');
      reference = project.title;
    }

    if (jobId) {
      job = await base44.entities.Job.get(jobId);
      if (!job) throw new Error('Job not found');
      reference = reference || `Job #${job.job_number}`;
    }

    const customerId = project?.customer_id || job?.customer_id;
    if (!customerId) throw new Error('No customer linked');
    
    customer = await base44.entities.Customer.get(customerId);
    if (!customer) throw new Error('Customer not found');

    // 2. Ensure Xero Contact exists/sync
    const connection = await refreshXeroTokenIfNeeded(base44);
    
    // Try to find contact by name or email
    let contactId = customer.xero_contact_id;
    
    if (!contactId) {
      // Search for contact
      const searchRes = await fetch(`https://api.xero.com/api.xro/2.0/Contacts?where=Name=="${encodeURIComponent(customer.name)}"`, {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Accept': 'application/json'
        }
      });
      
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.Contacts.length > 0) {
          contactId = searchData.Contacts[0].ContactID;
        }
      }
    }

    if (!contactId) {
      // Create contact
      const createContactRes = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Name: customer.name,
          EmailAddress: customer.email,
          Phones: [{ PhoneType: 'DEFAULT', PhoneNumber: customer.phone }],
          Addresses: [{ AddressType: 'STREET', AddressLine1: customer.address }]
        })
      });
      
      const contactData = await createContactRes.json();
      contactId = contactData.Contacts[0].ContactID;
      
      // Save back to customer
      await base44.entities.Customer.update(customer.id, { xero_contact_id: contactId });
    }

    // 3. Construct Invoice
    const xeroLineItems = lineItems.map(item => ({
      Description: item.description,
      Quantity: 1,
      UnitAmount: item.amount,
      DiscountRate: item.discount ? (item.discount / item.amount * 100).toFixed(2) : 0, // Simple discount calc if amount provided
      AccountCode: '200', // Default Sales
      TaxType: 'OUTPUT' // GST on Income
    }));

    const invoicePayload = {
      Type: 'ACCREC',
      Contact: { ContactID: contactId },
      Date: date || new Date().toISOString().split('T')[0],
      DueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      LineItems: xeroLineItems,
      Reference: reference,
      Status: 'AUTHORISED'
    };

    const invoiceRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'xero-tenant-id': connection.xero_tenant_id,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!invoiceRes.ok) {
      const err = await invoiceRes.text();
      throw new Error(`Xero Invoice Create Failed: ${err}`);
    }

    const invoiceData = await invoiceRes.json();
    const newInvoice = invoiceData.Invoices[0];

    // 4. Get Online Invoice URL
    const onlineUrlRes = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${newInvoice.InvoiceID}/OnlineInvoice`, {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'xero-tenant-id': connection.xero_tenant_id,
        'Accept': 'application/json'
      }
    });
    
    let publicUrl = '';
    if (onlineUrlRes.ok) {
      const urlData = await onlineUrlRes.json();
      publicUrl = urlData.OnlineInvoices[0].OnlineInvoiceUrl;
    }

    // 5. Save to XeroInvoice Entity
    const record = await base44.entities.XeroInvoice.create({
      xero_invoice_id: newInvoice.InvoiceID,
      xero_contact_id: contactId,
      xero_invoice_number: newInvoice.InvoiceNumber,
      project_id: projectId || null,
      job_id: jobId || null,
      job_number: job?.job_number || null,
      customer_id: customerId,
      customer_name: customer.name,
      organisation_id: project?.organisation_id || job?.organisation_id || null,
      status: newInvoice.Status,
      total: newInvoice.Total,
      amount_due: newInvoice.AmountDue,
      amount_paid: newInvoice.AmountPaid,
      currency: newInvoice.CurrencyCode,
      date: newInvoice.DateString,
      issued_at: newInvoice.DateString,
      due_date: newInvoice.DueDateString,
      xero_public_url: publicUrl,
      xero_internal_url: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${newInvoice.InvoiceID}`,
      created_by: user.email,
      contact_name: newInvoice.Contact.Name
    });

    return Response.json({ success: true, invoice: record });

  } catch (error) {
    console.error('createXeroInvoiceFromProjectOrJob error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});