import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshXeroTokenIfNeeded(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  
  if (connections.length === 0) {
    throw new Error('No Xero connection found');
  }

  const connection = connections[0];
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
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

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    });

    return {
      ...connection,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    };
  }

  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const connection = await refreshXeroTokenIfNeeded(base44);
    return Response.json({ 
      success: true,
      expires_at: connection.expires_at 
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export { refreshXeroTokenIfNeeded };