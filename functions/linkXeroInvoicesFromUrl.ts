import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get Xero connection details - refresh token first
    console.log('Refreshing Xero token...');
    const refreshResult = await base44.asServiceRole.functions.invoke('refreshXeroToken', {});
    console.log('Refresh result:', JSON.stringify(refreshResult));

    if (!refreshResult.data || !refreshResult.data.success) {
      console.error('Token refresh failed:', refreshResult.data);
      return Response.json({ 
        error: 'Failed to refresh Xero token', 
        details: refreshResult.data,
        fullResult: refreshResult
      }, { status: 400 });
    }

    // Small delay to ensure DB consistency after token refresh
    await new Promise(resolve => setTimeout(resolve, 500));

    const connections = await base44.asServiceRole.entities.XeroConnection.list();
    const xeroConnection = connections[0];

    console.log('Xero connection found:', xeroConnection ? 'yes' : 'no');
    console.log('Has access token:', xeroConnection?.access_token ? 'yes' : 'no');
    console.log('Access token (first 20 chars):', xeroConnection?.access_token?.substring(0, 20));
    console.log('Tenant ID:', xeroConnection?.tenant_id);
    console.log('Token expires at:', xeroConnection?.expires_at);
    
    if (!xeroConnection || !xeroConnection.access_token) {
      return Response.json({ error: 'No Xero connection found' }, { status: 400 });
    }

    // Fetch projects with xero_payment_url but no primary_xero_invoice_id
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const projectsNeedingInvoices = allProjects.filter(p => 
      p.xero_payment_url && !p.primary_xero_invoice_id
    );

    console.log(`Found ${projectsNeedingInvoices.length} projects with payment URLs but no linked invoices`);

    let linkedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failed = [];

    for (const project of projectsNeedingInvoices) {
      console.log(`\n--- Processing project ${project.project_number} ---`);
      console.log(`Payment URL: ${project.xero_payment_url}`);

      try {
        // Extract invoice ID from URL (format: https://in.xero.com/{shortCode})
        const urlMatch = project.xero_payment_url.match(/xero\.com\/([A-Za-z0-9]+)/);
        if (!urlMatch) {
          console.log(`Could not parse URL for project ${project.project_number}`);
          skippedCount++;
          continue;
        }

        // Search for invoice by project number (most reliable method)
        console.log(`Searching for invoice with number: ${project.project_number}`);
        const searchResponse = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="${project.project_number}"`,
          {
            headers: {
              'Authorization': `Bearer ${xeroConnection.access_token}`,
              'xero-tenant-id': xeroConnection.tenant_id,
              'Accept': 'application/json'
            }
          }
        );

        console.log(`Xero API response status: ${searchResponse.status}`);

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`Xero API error for project ${project.project_number}:`);
          console.error(`Status: ${searchResponse.status}`);
          console.error(`Response: ${errorText}`);
          console.error(`Headers: ${JSON.stringify(Object.fromEntries(searchResponse.headers.entries()))}`);
          throw new Error(`Xero API error: ${searchResponse.status} - ${errorText}`);
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.Invoices || searchData.Invoices.length === 0) {
          console.log(`No invoice found in Xero for project ${project.project_number}`);
          skippedCount++;
          continue;
        }

        const xeroInvoice = searchData.Invoices[0];

        // Check if XeroInvoice entity already exists
        const existingInvoices = await base44.asServiceRole.entities.XeroInvoice.filter({
          xero_invoice_id: xeroInvoice.InvoiceID
        });

        let invoiceEntityId;

        if (existingInvoices.length > 0) {
          // Use existing entity
          invoiceEntityId = existingInvoices[0].id;
          console.log(`Using existing XeroInvoice entity for project ${project.project_number}`);
        } else {
          // Create new XeroInvoice entity
          const newInvoice = await base44.asServiceRole.entities.XeroInvoice.create({
            xero_invoice_id: xeroInvoice.InvoiceID,
            project_id: project.id,
            invoice_number: xeroInvoice.InvoiceNumber,
            total: xeroInvoice.Total,
            amount_due: xeroInvoice.AmountDue,
            amount_paid: xeroInvoice.AmountPaid,
            status: xeroInvoice.Status,
            date: xeroInvoice.Date,
            due_date: xeroInvoice.DueDate,
            online_payment_url: project.xero_payment_url,
            raw_data: xeroInvoice
          });
          invoiceEntityId = newInvoice.id;
          console.log(`Created new XeroInvoice entity for project ${project.project_number}`);
        }

        // Link invoice to project
        const currentInvoices = project.xero_invoices || [];
        await base44.asServiceRole.entities.Project.update(project.id, {
          primary_xero_invoice_id: invoiceEntityId,
          xero_invoices: [...currentInvoices, invoiceEntityId].filter((v, i, a) => a.indexOf(v) === i) // deduplicate
        });

        linkedCount++;
        console.log(`Linked invoice to project ${project.project_number}`);

      } catch (error) {
        failedCount++;
        failed.push({
          project_id: project.id,
          project_number: project.project_number,
          error: error.message
        });
        console.error(`Failed to process project ${project.project_number}:`, error.message);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      total_projects: projectsNeedingInvoices.length,
      linked: linkedCount,
      skipped: skippedCount,
      failed: failedCount,
      failed_details: failed
    });

  } catch (error) {
    console.error('Error linking Xero invoices:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});