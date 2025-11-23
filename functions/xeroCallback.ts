import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return Response.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');
    const redirectUri = Deno.env.get('XERO_REDIRECT_URI');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Get tenant connections
    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!connectionsResponse.ok) {
      throw new Error('Failed to get Xero connections');
    }

    const connections = await connectionsResponse.json();
    
    if (connections.length === 0) {
      throw new Error('No Xero organisations found');
    }

    // Use the first tenant
    const tenant = connections[0];

    const base44 = createClientFromRequest(req);

    // Check for existing connection and update, or create new
    const existingConnections = await base44.asServiceRole.entities.XeroConnection.list();
    
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const connectionData = {
      organisation_name: tenant.tenantName,
      xero_tenant_id: tenant.tenantId,
      xero_tenant_name: tenant.tenantName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      created_by_user_id: state
    };

    if (existingConnections.length > 0) {
      await base44.asServiceRole.entities.XeroConnection.update(existingConnections[0].id, connectionData);
    } else {
      await base44.asServiceRole.entities.XeroConnection.create(connectionData);
    }

    // Redirect to a success page or back to app
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/?xero=connected'
      }
    });

  } catch (error) {
    console.error('Xero callback error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/?xero=error&message=' + encodeURIComponent(error.message)
      }
    });
  }
});