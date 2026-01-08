import { createClientFromRequest } from './shared/sdk.js';

async function refreshAndGetConnection(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  if (connections.length === 0) throw new Error('No Xero connection found');
  
  const connection = connections[0];
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

    return { ...connection, access_token: tokens.access_token };
  }

  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Unauthorized - Admin or Manager access required' }, { status: 403 });
    }
    
    // Search Xero invoices endpoint

    const { search = '', page = 1 } = await req.json().catch(() => ({}));

    const connection = await refreshAndGetConnection(base44);

    // Build Xero API URL with filters
    // Fetch invoices (Type=ACCREC), excluding voided and bills (Type=ACCPAY)
    // Fetch multiple pages to get comprehensive results
    const allInvoices = [];
    let maxPages = 20; // Fetch up to 2,000 invoices (20 pages x 100)
    
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      const url = `https://api.xero.com/api.xro/2.0/Invoices?Statuses=DRAFT,SUBMITTED,AUTHORISED,PAID&Type=ACCREC&order=UpdatedDateUTC DESC&page=${currentPage}`;
      
      const xeroResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Accept': 'application/json'
        }
      });

      if (!xeroResponse.ok) {
        const error = await xeroResponse.text();
        throw new Error(`Xero API error: ${error}`);
      }

      const xeroResult = await xeroResponse.json();
      const pageInvoices = xeroResult.Invoices || [];
      
      if (pageInvoices.length === 0) break; // No more invoices
      
      allInvoices.push(...pageInvoices);
      
      // If we got less than 100, we're on the last page
      if (pageInvoices.length < 100) break;
    }

    let invoices = allInvoices;

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      invoices = invoices.filter(inv => 
        inv.InvoiceNumber?.toLowerCase().includes(searchLower) ||
        inv.Contact?.Name?.toLowerCase().includes(searchLower) ||
        inv.Reference?.toLowerCase().includes(searchLower)
      );
    }

    // Helper to parse Xero date format (can be /Date(1234567890000)/ or ISO format)
    const parseXeroDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        // Handle /Date(milliseconds)/ format
        const msMatch = dateStr.match(/\/Date\((\d+)\)/);
        if (msMatch) {
          const ms = parseInt(msMatch[1], 10);
          if (isNaN(ms)) return null;
          const date = new Date(ms);
          if (isNaN(date.getTime())) return null;
          return date.toISOString().split('T')[0];
        }
        // Handle ISO format
        if (dateStr.includes('T')) {
          return dateStr.split('T')[0];
        }
        // Validate it's a valid date string
        const testDate = new Date(dateStr);
        if (isNaN(testDate.getTime())) return null;
        return dateStr;
      } catch {
        return null;
      }
    };

    // Map to simplified format and filter out bills (Type=ACCPAY)
    const mappedInvoices = invoices
      .filter(inv => inv.Type === 'ACCREC') // Only invoices, not bills
      .map(inv => ({
        xero_invoice_id: inv.InvoiceID,
        xero_invoice_number: inv.InvoiceNumber,
        contact_name: inv.Contact?.Name,
        contact_id: inv.Contact?.ContactID,
        reference: inv.Reference,
        status: inv.Status,
        total: inv.Total,
        amount_due: inv.AmountDue,
        amount_paid: inv.AmountPaid,
        date: parseXeroDate(inv.Date),
        due_date: parseXeroDate(inv.DueDate)
      }));

    return Response.json({
      success: true,
      invoices: mappedInvoices,
      total: mappedInvoices.length
    });

  } catch (error) {
    console.error('Search Xero invoices error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});