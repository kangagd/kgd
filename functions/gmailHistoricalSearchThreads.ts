import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function gmailFetch(base44, endpoint, method = 'GET', body = null, queryParams = null) {
  let retries = 0;
  const maxRetries = 4;
  const baseBackoffMs = 1000;

  const shouldRetry = (status) => {
    if (status === 429 || (status >= 500 && status < 600)) return true;
    return false;
  };

  const getBackoffDelay = (attemptIndex) => {
    const baseDelay = Math.min(baseBackoffMs * Math.pow(2, attemptIndex), 8000);
    const jitter = Math.random() * 1000 - 500;
    return Math.max(baseDelay + jitter, 100);
  };

  while (retries < maxRetries) {
    try {
      const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");
      
      let url = `https://www.googleapis.com${endpoint}`;
      
      if (queryParams) {
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            params.append(key, value);
          }
        });
        url += `?${params.toString()}`;
      }

      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        if (shouldRetry(response.status) && retries < maxRetries - 1) {
          retries++;
          const delay = getBackoffDelay(retries - 1);
          console.log(`[gmailFetch] Transient error ${response.status}, retry ${retries}/${maxRetries} in ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < maxRetries - 1) {
        retries++;
        const delay = getBackoffDelay(retries - 1);
        console.log(`[gmailFetch] Network error, retry ${retries}/${maxRetries} in ${Math.round(delay)}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let requestBody = {};
    try {
      const bodyText = await req.text();
      requestBody = bodyText ? JSON.parse(bodyText) : {};
    } catch (parseErr) {
      console.error('[gmailHistoricalSearchThreads] JSON parse error:', parseErr);
      return Response.json({
        threads: [],
        nextPageToken: null,
        error: 'Invalid request body'
      }, { status: 200 });
    }

    // Extract and validate inputs
    const { query = '', pageToken = null, maxResults = 20, filters = {} } = requestBody;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log('[gmailHistoricalSearchThreads] Empty query, returning empty results');
      return Response.json({
        threads: [],
        nextPageToken: null,
        error: 'Missing query'
      }, { status: 200 });
    }

    // Apply filters
    const { notImported = false, hasAttachments = false, before = null, after = null } = filters;

    // Build Gmail query
    let searchQuery = query;
    if (!query.includes('in:')) {
      searchQuery = `in:anywhere (${query})`;
    }
    if (after) {
      searchQuery += ` after:${after}`;
    }
    if (before) {
      searchQuery += ` before:${before}`;
    }
    if (hasAttachments) {
      searchQuery += ` has:attachment`;
    }

    console.log('[gmailHistoricalSearchThreads] Query:', searchQuery, 'PageToken:', pageToken);

    // Fetch threads from Gmail
    let listResult;
    try {
      const queryParams = {
        q: searchQuery,
        maxResults: Math.min(maxResults || 20, 100)
      };
      if (pageToken) {
        queryParams.pageToken = pageToken;
      }

      listResult = await gmailFetch(base44, '/gmail/v1/users/me/threads', 'GET', null, queryParams);
    } catch (gmailErr) {
      console.error('[gmailHistoricalSearchThreads] Gmail list error:', gmailErr);
      return Response.json({
        threads: [],
        nextPageToken: null,
        error: 'Gmail search failed',
        errorDetail: String(gmailErr?.message || gmailErr)
      }, { status: 200 });
    }

    const threads = listResult.threads || [];
    console.log(`[gmailHistoricalSearchThreads] Found ${threads.length} threads`);

    // Fetch metadata for each thread
    const results = [];
    for (let i = 0; i < threads.length; i++) {
      const gmailThread = threads[i];
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const threadDetail = await gmailFetch(
          base44,
          `/gmail/v1/users/me/threads/${gmailThread.id}`,
          'GET',
          null,
          { format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'] }
        );

        if (!threadDetail.messages || threadDetail.messages.length === 0) {
          continue;
        }

        // Get headers from FIRST message (where subject originates)
        const firstMsg = threadDetail.messages[0];
        const headerMap = {};
        if (firstMsg.payload?.headers) {
          firstMsg.payload.headers.forEach(h => {
            headerMap[h.name.toLowerCase()] = h.value;
          });
        }

        const subject = headerMap['subject'] || '(no subject)';
        const fromAddress = headerMap['from'] || '';
        const toAddresses = headerMap['to'] ? headerMap['to'].split(',').map(e => e.trim()) : [];

        let snippet = threadDetail.snippet || '';
        if (snippet.length > 200) {
          snippet = snippet.substring(0, 200) + '...';
        }

        // Use LAST message date for thread activity
        const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
        const lastMsgDate = lastMsg.internalDate ? new Date(parseInt(lastMsg.internalDate)).toISOString() : new Date().toISOString();

        // Check for attachments
        let threadHasAttachments = false;
        const checkAttachments = (parts) => {
          if (!parts || !Array.isArray(parts)) return false;
          for (const part of parts) {
            if (part.filename && part.filename.length > 0) {
              return true;
            }
            if (part.parts && checkAttachments(part.parts)) {
              return true;
            }
          }
          return false;
        };
        if (lastMsg.payload?.parts) {
          threadHasAttachments = checkAttachments(lastMsg.payload.parts);
        }

        results.push({
          gmail_thread_id: gmailThread.id,
          subject,
          snippet,
          lastMessageAt: lastMsgDate,
          participants: {
            from: fromAddress,
            to: toAddresses
          },
          messageCount: threadDetail.messages.length,
          hasAttachments: threadHasAttachments
        });
      } catch (err) {
        console.error(`[gmailHistoricalSearchThreads] Error processing thread ${gmailThread.id}:`, err);
      }
    }

    // Enrich with import and linking status
    if (results.length > 0) {
      try {
        const gmailThreadIds = results.map(r => r.gmail_thread_id);
        
        // Query EmailThread for matching threads
        const emailThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: { $in: gmailThreadIds }
        });
        
        const importedMap = new Map();
        emailThreads.forEach(t => {
          if (t.gmail_thread_id) {
            importedMap.set(t.gmail_thread_id, {
              linkedEntityType: t.linkedEntityType || 'none',
              linkedEntityTitle: t.linkedEntityTitle || null
            });
          }
        });

        // Add import state and linking info to each result
        results.forEach(r => {
          const emailThread = importedMap.get(r.gmail_thread_id);
          
          if (!emailThread) {
            r.importedState = 'not_imported';
            r.linkedEntityType = 'none';
            r.linkedEntityTitle = null;
          } else if (emailThread.linkedEntityType === 'none' || !emailThread.linkedEntityType) {
            r.importedState = 'imported_unlinked';
            r.linkedEntityType = 'none';
            r.linkedEntityTitle = null;
          } else {
            r.importedState = 'imported_linked';
            r.linkedEntityType = emailThread.linkedEntityType;
            r.linkedEntityTitle = emailThread.linkedEntityTitle;
          }
        });
      } catch (enrichErr) {
        console.error('[gmailHistoricalSearchThreads] Error enriching results:', enrichErr);
        // Gracefully degrade: mark all as not_imported if enrichment fails
        results.forEach(r => {
          r.importedState = 'not_imported';
          r.linkedEntityType = 'none';
          r.linkedEntityTitle = null;
        });
      }
    }

    return Response.json({
      threads: results,
      nextPageToken: listResult.nextPageToken || null
    }, { status: 200 });
  } catch (error) {
    console.error('[gmailHistoricalSearchThreads] Unhandled error:', error);
    return Response.json({
      threads: [],
      nextPageToken: null,
      error: 'Gmail search failed',
      errorDetail: String(error?.message || error)
    }, { status: 200 });
  }
});