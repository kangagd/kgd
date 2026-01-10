import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and manager can list threads
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    if (!isAdminOrManager) {
      return Response.json({ error: 'Forbidden: Only admin and managers can list threads' }, { status: 403 });
    }

    const { q, maxResults = 50, pageToken } = await req.json();

    const queryParams = {
      maxResults,
      pageToken
    };

    if (q) {
      queryParams.q = q;
    }

    const result = await gmailFetch('/gmail/v1/users/me/threads', 'GET', null, queryParams);

    return Response.json({
      threads: result.threads || [],
      nextPageToken: result.nextPageToken,
      resultSizeEstimate: result.resultSizeEstimate
    });
  } catch (error) {
    console.error('Error listing Gmail threads:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});