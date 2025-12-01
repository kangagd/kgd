import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { xero_invoice_id } = await req.json();

    if (!xero_invoice_id) {
      return Response.json({ error: 'xero_invoice_id is required' }, { status: 400 });
    }

    const connection = await refreshAndGetConnection(base44);

    // Fetch invoice PDF from Xero
    const pdfResponse = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${xero_invoice_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'xero-tenant-id': connection.xero_tenant_id,
        'Accept': 'application/pdf'
      }
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      throw new Error(`Failed to fetch PDF from Xero: ${errorText}`);
    }

    const pdfBytes = await pdfResponse.arrayBuffer();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${xero_invoice_id}.pdf`
      }
    });

  } catch (error) {
    console.error('Get invoice PDF error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch invoice PDF'
    }, { status: 500 });
  }
});