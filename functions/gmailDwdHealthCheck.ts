import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailDwdFetch } from './shared/gmailDwdClient.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate Base44 user (for app access control only)
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Call Gmail API using Domain-Wide Delegation
    const profile = await gmailDwdFetch('/gmail/v1/users/me/profile', 'GET');
    
    return Response.json({
      success: true,
      emailAddress: profile.emailAddress,
      messagesTotal: profile.messagesTotal || 0,
      threadsTotal: profile.threadsTotal || 0,
      historyId: profile.historyId
    });
  } catch (error) {
    console.error('Gmail DWD health check error:', error);
    
    // Return structured error
    return Response.json({
      success: false,
      error: error.message,
      details: error.message.includes('Missing') 
        ? 'Required environment variables not set. Please configure GOOGLE_WORKSPACE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_WORKSPACE_SERVICE_ACCOUNT_PRIVATE_KEY, and optionally GMAIL_DWD_IMPERSONATE_EMAIL.'
        : 'Authentication or Gmail API error'
    }, { status: 500 });
  }
});