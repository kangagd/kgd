import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

function base64urlEncode(data) {
  const base64 = btoa(data);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToArrayBuffer(pem) {
  const cleanPem = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createJwt(serviceAccount, impersonateEmail) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: GMAIL_SCOPES.join(' '),
    sub: impersonateEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  const privateKeyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureBinary = String.fromCharCode(...signatureArray);
  const signatureEncoded = base64urlEncode(signatureBinary);

  return `${signatureInput}.${signatureEncoded}`;
}

async function getAccessToken() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

  if (!serviceAccountJson || !impersonateEmail) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_IMPERSONATE_USER_EMAIL');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const jwt = await createJwt(serviceAccount, impersonateEmail);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString()
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function gmailFetch(endpoint, method = 'GET', body = null, queryParams = null) {
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
      const accessToken = await getAccessToken();
      
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

      listResult = await gmailFetch('/gmail/v1/users/me/threads', 'GET', null, queryParams);
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
          `/gmail/v1/users/me/threads/${gmailThread.id}`,
          'GET',
          null,
          { format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'] }
        );

        if (!threadDetail.messages || threadDetail.messages.length === 0) {
          continue;
        }

        const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
        const lastHeaders = {};
        if (lastMsg.payload?.headers) {
          lastMsg.payload.headers.forEach(h => {
            lastHeaders[h.name.toLowerCase()] = h.value;
          });
        }

        const subject = lastHeaders['subject'] || '(no subject)';
        const fromAddress = lastHeaders['from'] || '';
        const toAddresses = lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [];

        let snippet = threadDetail.snippet || '';
        if (snippet.length > 200) {
          snippet = snippet.substring(0, 200) + '...';
        }

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

    // Enrich with import status
    if (results.length > 0) {
      try {
        const allImportedThreads = await base44.asServiceRole.entities.EmailThread.filter({});
        const importedMap = new Map();
        allImportedThreads.forEach(t => {
          if (t.gmail_thread_id) {
            importedMap.set(t.gmail_thread_id, t);
          }
        });

        results.forEach(r => {
          const imported = importedMap.get(r.gmail_thread_id);
          if (imported) {
            r.imported = true;
            r.linkedEntityType = imported.linkedEntityType || null;
            r.linkedEntityTitle = imported.linkedEntityTitle || null;
          } else {
            r.imported = false;
          }
        });
      } catch (enrichErr) {
        console.error('[gmailHistoricalSearchThreads] Error enriching results:', enrichErr);
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