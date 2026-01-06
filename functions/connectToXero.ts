import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Generate Xero OAuth URL
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const redirectUri = Deno.env.get('XERO_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      return Response.json({ error: 'Xero credentials not configured' }, { status: 500 });
    }

    const scopes = 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access';
    const authUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${user.id}`;

    return Response.json({ authUrl });
  } catch (error) {
    console.error('Xero connection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});