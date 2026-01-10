import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getAccessToken } from './shared/gmailClient.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ connected: false }, { status: 200 });
    }

    // Check if Service Account credentials are configured
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');
    
    if (!serviceAccountJson || !impersonateEmail) {
      return Response.json({ connected: false }, { status: 200 });
    }

    // Try to get an access token to verify the Service Account works
    try {
      await getAccessToken();
      return Response.json({ connected: true });
    } catch (error) {
      console.error('Failed to get Gmail access token:', error);
      return Response.json({ connected: false }, { status: 200 });
    }
  } catch (error) {
    console.error('Error checking Gmail connection:', error);
    return Response.json({ connected: false }, { status: 200 });
  }
});