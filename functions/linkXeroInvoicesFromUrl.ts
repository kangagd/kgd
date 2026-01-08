import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get fresh Xero connection with token refresh
    const connections = await base44.asServiceRole.entities.XeroConnection.list();
    let xeroConnection = connections[0];

    if (!xeroConnection || !xeroConnection.refresh_token) {
      return Response.json({ error: 'No Xero connection found. Please reconnect Xero.' }, { status: 400 });
    }

    // Check if token needs refresh (expires in less than 5 minutes)
    const expiresAt = new Date(xeroConnection.expires_at);
    const now = new Date();
    const needsRefresh = (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000;

    console.log('Token expires at:', xeroConnection.expires_at);
    console.log('Needs refresh:', needsRefresh);

    if (needsRefresh) {
      console.log('Refreshing Xero token...');
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
          refresh_token: xeroConnection.refresh_token
        })
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token refresh failed:', error);
        return Response.json({ 
          error: 'Token refresh failed. Please reconnect Xero.',
          details: error
        }, { status: 400 });
      }

      const tokens = await tokenResponse.json();
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await base44.asServiceRole.entities.XeroConnection.update(xeroConnection.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: newExpiresAt
      });

      xeroConnection = {
        ...xeroConnection,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: newExpiresAt
      };

      console.log('Token refreshed successfully');
    }

    console.log('Using access token (first 20 chars):', xeroConnection.access_token.substring(0, 20));
    
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
        console.log(`Tenant ID: ${xeroConnection.tenant_id}`);
        console.log(`Token (first 30): ${xeroConnection.access_token.substring(0, 30)}`);
        
        const searchResponse = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices?where=InvoiceNumber=="${project.project_number}"`,
          {
            headers: {
              'Authorization': `Bearer ${xeroConnection.access_token}`,
              'Xero-tenant-id': xeroConnection.xero_tenant_id,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
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
            xero_invoice_number: xeroInvoice.InvoiceNumber,
            total: xeroInvoice.Total,
            total_amount: xeroInvoice.Total,
            amount_due: xeroInvoice.AmountDue,
            amount_paid: xeroInvoice.AmountPaid,
            status: xeroInvoice.Status,
            date: xeroInvoice.Date,
            issue_date: xeroInvoice.Date,
            due_date: xeroInvoice.DueDate,
            online_payment_url: project.xero_payment_url,
            online_invoice_url: project.xero_payment_url,
            contact_name: xeroInvoice.Contact?.Name || project.customer_name,
            raw_payload: xeroInvoice
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