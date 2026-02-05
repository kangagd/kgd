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
          console.log(`[gmailGetThreadPreviewContent] Transient error ${response.status}, retry ${retries}/${maxRetries} in ${Math.round(delay)}ms`);
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
        console.log(`[gmailGetThreadPreviewContent] Network error, retry ${retries}/${maxRetries} in ${Math.round(delay)}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

// Helper: Decode base64url UTF-8 text (EXACTLY ONCE, no regex hacks)
function decodeBase64Url(str) {
  if (!str) return '';
  try {
    // Replace base64url chars with standard base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Decode using atob (which produces UTF-8 bytes)
    const decoded = atob(base64);
    // Convert byte string to actual UTF-8 string
    return new TextDecoder().decode(
      new Uint8Array([...decoded].map(c => c.charCodeAt(0)))
    );
  } catch (err) {
    console.error('[decodeBase64Url] Error decoding:', err);
    return '';
  }
}

// Helper: Extract text body from message payload
function extractBodyText(payload) {
  let bodyHtml = null;
  let bodyText = null;

  // If payload has direct body.data (not multipart)
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
    return { bodyHtml, bodyText };
  }

  // If multipart, search for text/plain and text/html parts
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data && !bodyText) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data && !bodyHtml) {
        bodyHtml = decodeBase64Url(part.body.data);
      }
    }
  }

  return { bodyHtml, bodyText };
}

// Helper: Check for attachments in payload
function findAttachments(payload) {
  const attachments = [];

  const traverse = (part) => {
    if (!part) return;

    if (part.filename && part.filename.length > 0) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.size || 0
      });
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  };

  traverse(payload);
  return attachments;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ gmailThreadId: '', messages: [], error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let requestBody = {};
    try {
      const bodyText = await req.text();
      requestBody = bodyText ? JSON.parse(bodyText) : {};
    } catch (parseErr) {
      console.error('[gmailGetThreadPreviewContent] JSON parse error:', parseErr);
      return Response.json({
        gmailThreadId: '',
        messages: [],
        error: 'Invalid request body'
      }, { status: 200 });
    }

    const { gmailThreadId = '', limit = 5 } = requestBody;

    if (!gmailThreadId || typeof gmailThreadId !== 'string') {
      return Response.json({
        gmailThreadId: '',
        messages: [],
        error: 'Missing gmailThreadId'
      }, { status: 200 });
    }

    console.log(`[gmailGetThreadPreviewContent] Fetching thread ${gmailThreadId} with limit ${limit}`);

    // Step 1: Fetch thread metadata to get message IDs
    let threadDetail;
    try {
      threadDetail = await gmailFetch(
        base44,
        `/gmail/v1/users/me/threads/${gmailThreadId}`,
        'GET',
        null,
        { format: 'minimal' }
      );
    } catch (err) {
      console.error(`[gmailGetThreadPreviewContent] Error fetching thread:`, err);
      return Response.json({
        gmailThreadId,
        messages: [],
        error: 'Failed to load thread content',
        errorDetail: String(err?.message || err)
      }, { status: 200 });
    }

    if (!threadDetail.messages || threadDetail.messages.length === 0) {
      return Response.json({
        gmailThreadId,
        messages: []
      }, { status: 200 });
    }

    // Step 2: Sort messages by internalDate (oldest → newest)
    const messages = [...threadDetail.messages].sort((a, b) => {
      const dateA = parseInt(a.internalDate || '0');
      const dateB = parseInt(b.internalDate || '0');
      return dateA - dateB;
    });

    // Step 3: Take last `limit` message IDs
    const messagesToFetch = messages.slice(-limit);
    console.log(`[gmailGetThreadPreviewContent] Fetching ${messagesToFetch.length} messages (limit: ${limit})`);

    // Step 4: Fetch full message content for each
    const results = [];
    for (let i = 0; i < messagesToFetch.length; i++) {
      const msgRef = messagesToFetch[i];
      
      try {
        // 50ms+ delay between API calls
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const msgFull = await gmailFetch(
          base44,
          `/gmail/v1/users/me/messages/${msgRef.id}`,
          'GET',
          null,
          { format: 'full' }
        );

        if (!msgFull.payload) {
          console.error(`[gmailGetThreadPreviewContent] No payload for message ${msgRef.id}`);
          continue;
        }

        // Extract headers
        const headerMap = {};
        if (msgFull.payload.headers) {
          msgFull.payload.headers.forEach(h => {
            headerMap[h.name.toLowerCase()] = h.value;
          });
        }

        const from = headerMap['from'] || '';
        const to = headerMap['to'] || '';
        const cc = headerMap['cc'] || '';
        const subject = headerMap['subject'] || '(no subject)';
        const dateStr = headerMap['date'] || new Date(parseInt(msgFull.internalDate || 0)).toISOString();

        // Parse date to ISO if needed
        let dateIso;
        try {
          dateIso = new Date(dateStr).toISOString();
        } catch {
          dateIso = new Date(parseInt(msgFull.internalDate || 0)).toISOString();
        }

        // Extract body text
        const { bodyHtml, bodyText } = extractBodyText(msgFull.payload);

        // Get snippet
        const snippet = msgFull.snippet || '';

        // Find attachments
        const attachments = findAttachments(msgFull.payload);
        const hasAttachments = attachments.length > 0;

        results.push({
          gmailMessageId: msgRef.id,
          from,
          to,
          cc,
          dateIso,
          subject,
          bodyHtml,
          bodyText,
          snippet,
          hasAttachments,
          attachments
        });
      } catch (err) {
        console.error(`[gmailGetThreadPreviewContent] Error fetching message ${msgRef.id}:`, err);
        // Continue with next message, don't fail entire request
      }
    }

    return Response.json({
      gmailThreadId,
      messages: results
    }, { status: 200 });
  } catch (error) {
    console.error('[gmailGetThreadPreviewContent] Unhandled error:', error);
    return Response.json({
      gmailThreadId: '',
      messages: [],
      error: 'Failed to load thread content',
      errorDetail: String(error?.message || error)
    }, { status: 200 });
  }
});