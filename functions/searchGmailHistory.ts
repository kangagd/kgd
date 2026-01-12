import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, sender, recipient, dateFrom, dateTo, maxResults = 50 } = await req.json();

    if (!query && !sender && !recipient) {
      return Response.json({ error: 'At least one search parameter required' }, { status: 400 });
    }

    // Build Gmail search query
    const queryParts = [];
    if (query) queryParts.push(query);
    if (sender) queryParts.push(`from:${sender}`);
    if (recipient) queryParts.push(`to:${recipient}`);
    if (dateFrom) queryParts.push(`after:${dateFrom.replace(/-/g, '/')}`);
    if (dateTo) queryParts.push(`before:${dateTo.replace(/-/g, '/')}`);
    
    const gmailQuery = queryParts.join(' ');

    // Use shared service account for search
    const data = await gmailFetch('/gmail/v1/users/me/messages', 'GET', null, {
      q: gmailQuery,
      maxResults
    });
    const messageIds = data.messages || [];

    if (messageIds.length === 0) {
      return Response.json({ threads: [], found: 0 });
    }

    // Fetch thread details for display using shared service account
    const threadMap = new Map();
    const MAX_THREADS = 10; // Service account can handle more since it's shared quota
    const DELAY_MS = 200; // Lighter delay since we're not rate-limited per user

    for (let i = 0; i < Math.min(MAX_THREADS, messageIds.length); i++) {
      const msg = messageIds[i];

      // Rate limiting delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }

      try {
        const detail = await gmailFetch(`/gmail/v1/users/me/messages/${msg.id}`, 'GET', null, {
          format: 'metadata',
          headers: 'Subject,From,Date'
        });
        const headers = detail.payload?.headers || [];
        
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const gmailThreadId = detail.threadId;

        if (!threadMap.has(gmailThreadId)) {
          // Check if already synced AND has messages (not a ghost thread)
          const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
            gmail_thread_id: gmailThreadId
          });

          let isSynced = false;
          let syncedId = null;

          if (existingThreads.length > 0) {
            const thread = existingThreads[0];
            // Only mark as synced if the thread has messages
            const messages = await base44.asServiceRole.entities.EmailMessage.filter({
              thread_id: thread.id
            });
            if (messages.length > 0) {
              isSynced = true;
              syncedId = thread.id;
            }
          }

          threadMap.set(gmailThreadId, {
            gmail_thread_id: gmailThreadId,
            subject,
            from,
            snippet: detail.snippet || '',
            date,
            is_synced: isSynced,
            synced_id: syncedId
          });
        }
      } catch (err) {
        console.error(`Error fetching message ${msg.id}:`, err);
      }
    }

    const threads = Array.from(threadMap.values());
    return Response.json({ threads, found: messageIds.length });
  } catch (error) {
    console.error('Search Gmail history error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});