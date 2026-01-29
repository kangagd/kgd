/**
 * gmailSyncThreadMessages - Reliable Gmail message sync with robust MIME parsing
 * 
 * - Fetches full message payloads (format=full)
 * - Recursively traverses multipart MIME structures
 * - Extracts body_html (preferred) or body_text (fallback)
 * - Stores explicit has_body, sync_status, parse_error, last_synced_at fields
 * - Idempotent upserts by gmail_message_id
 * - Updates EmailThread snippet from latest message body
 * - Retry logic with exponential backoff
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

// ============================================================================
// JWT & Gmail API Helpers
// ============================================================================

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
  const maxRetries = 3;
  const baseBackoffMs = 1000;

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
        if ((response.status === 429 || response.status >= 500) && retries < maxRetries - 1) {
          retries++;
          const delay = getBackoffDelay(retries - 1);
          console.log(`[gmailSyncThreadMessages] Retry ${retries}/${maxRetries} in ${Math.round(delay)}ms (status ${response.status})`);
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
        console.log(`[gmailSyncThreadMessages] Network error, retry ${retries}/${maxRetries}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed after max retries');
}

// ============================================================================
// Body Coalescing & Sync Status Helpers
// ============================================================================

/**
 * Check if a string is non-empty (not null, not "", not whitespace-only)
 */
function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Check if HTML is empty after stripping tags
 * Considers "empty" if: null/undefined, whitespace, or tags-only content
 */
function isEmptyHtml(html) {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

/**
 * Determine if message has usable body content
 */
function hasBodyTruth(bodyHtml, bodyText) {
  return isNonEmptyString(bodyHtml) && !isEmptyHtml(bodyHtml) ||
         isNonEmptyString(bodyText);
}

/**
 * Coalesce incoming and existing bodies, never downgrading
 * Rule: prefer non-empty incoming; fall back to existing; never overwrite non-empty with empty
 */
function coalesceBody(existing, incoming) {
  const incomingHtmlGood = isNonEmptyString(incoming.body_html) && !isEmptyHtml(incoming.body_html);
  const existingHtmlGood = isNonEmptyString(existing?.body_html) && !isEmptyHtml(existing.body_html);
  const incomingTextGood = isNonEmptyString(incoming.body_text);
  const existingTextGood = isNonEmptyString(existing?.body_text);

  return {
    body_html: incomingHtmlGood ? incoming.body_html : (existingHtmlGood ? existing.body_html : ''),
    body_text: incomingTextGood ? incoming.body_text : (existingTextGood ? existing.body_text : '')
  };
}

/**
 * Compute sync_status based on parse result and body availability
 */
function computeSyncStatus(incomingResult, parseError) {
  if (parseError) return 'failed';
  
  const hasBody = hasBodyTruth(incomingResult?.body_html, incomingResult?.body_text);
  return hasBody ? 'ok' : 'partial';
}

// ============================================================================
// Robust MIME Parsing
// ============================================================================

function base64urlDecode(base64urlData) {
  try {
    // Convert base64url to base64
    const base64 = base64urlData.replace(/-/g, '+').replace(/_/g, '/');
    // Decode base64 to UTF-8 string
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    console.error('[gmailSyncThreadMessages] Base64 decode error:', err.message);
    return '';
  }
}

function htmlToPlainText(html) {
  if (!html) return '';
  let text = html;
  
  // Replace block elements with newlines
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/blockquote>/gi, '\n');
  
  // Remove all tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  
  return text.trim();
}

function extractBodyFromMimeParts(parts, depth = 0) {
  const result = { body_html: '', body_text: '' };
  
  if (!parts || !Array.isArray(parts) || depth > 10) {
    return result;
  }

  for (const part of parts) {
    if (!part) continue;

    // Prefer text/html
    if (part.mimeType === 'text/html' && part.body?.data && !result.body_html) {
      result.body_html = base64urlDecode(part.body.data);
      if (result.body_html && !result.body_text) {
        result.body_text = htmlToPlainText(result.body_html);
      }
    }

    // Fallback to text/plain
    if (part.mimeType === 'text/plain' && part.body?.data && !result.body_text) {
      result.body_text = base64urlDecode(part.body.data);
    }

    // Recurse into multipart (multipart/alternative, multipart/mixed, multipart/related, etc.)
    if (part.parts && !result.body_html && !result.body_text) {
      const subResult = extractBodyFromMimeParts(part.parts, depth + 1);
      if (subResult.body_html) result.body_html = subResult.body_html;
      if (subResult.body_text) result.body_text = subResult.body_text;
    }
  }

  return result;
}

function extractBodyFromPayload(payload) {
  const result = { body_html: '', body_text: '' };

  if (!payload) return result;

  // Top-level body data (simple message or wrapped in single part)
  if (payload.body?.data) {
    const bodyData = base64urlDecode(payload.body.data);
    
    // Check if it looks like HTML or plain text
    if (bodyData.includes('<html') || bodyData.includes('<body') || bodyData.includes('<p>')) {
      result.body_html = bodyData;
      result.body_text = htmlToPlainText(bodyData);
    } else {
      result.body_text = bodyData;
    }
  }

  // Multipart structure
  if (payload.parts) {
    const partResult = extractBodyFromMimeParts(payload.parts);
    if (partResult.body_html) result.body_html = partResult.body_html;
    if (partResult.body_text) result.body_text = partResult.body_text;
  }

  return result;
}

// ============================================================================
// Attachment Extraction (added 2026-01-29)
// ============================================================================

/**
 * Normalize Content-ID: strip angle brackets and whitespace
 * Example: "<abc123@mail.gmail.com>" -> "abc123@mail.gmail.com"
 */
function normalizeContentId(contentId) {
  if (!contentId) return null;
  return contentId.replace(/^<|>$/g, '').trim();
}

/**
 * Extract attachment metadata from a MIME part
 */
function extractAttachmentFromPart(part, gmailMessageId) {
  if (!part || !part.filename) return null;
  
  // Determine if inline (has Content-ID or Content-Disposition: inline)
  const headers = part.headers || [];
  let contentId = null;
  let isInline = false;
  
  for (const header of headers) {
    const name = header.name?.toLowerCase();
    if (name === 'content-id') {
      contentId = normalizeContentId(header.value);
      isInline = true;
    }
    if (name === 'content-disposition' && header.value?.toLowerCase().includes('inline')) {
      isInline = true;
    }
  }
  
  return {
    filename: part.filename,
    mime_type: part.mimeType || 'application/octet-stream',
    size: part.body?.size || 0,
    attachment_id: part.body?.attachmentId || null,
    gmail_message_id: gmailMessageId,
    content_id: contentId,
    content_id_normalized: contentId, // For cid: matching in UI
    is_inline: isInline
  };
}

/**
 * Recursively extract attachments from MIME parts
 */
function extractAttachmentsFromMimeParts(parts, gmailMessageId, depth = 0) {
  const attachments = [];
  
  if (!parts || !Array.isArray(parts) || depth > 10) {
    return attachments;
  }
  
  for (const part of parts) {
    if (!part) continue;
    
    // Check if this part is an attachment
    if (part.filename && part.body?.attachmentId) {
      const attachment = extractAttachmentFromPart(part, gmailMessageId);
      if (attachment) {
        attachments.push(attachment);
      }
    }
    
    // Recurse into nested parts
    if (part.parts) {
      const nestedAttachments = extractAttachmentsFromMimeParts(part.parts, gmailMessageId, depth + 1);
      attachments.push(...nestedAttachments);
    }
  }
  
  return attachments;
}

/**
 * Extract all attachments from message payload
 */
function extractAttachmentsFromPayload(payload, gmailMessageId) {
  if (!payload) return [];
  
  const attachments = [];
  
  // Check top-level parts
  if (payload.parts) {
    attachments.push(...extractAttachmentsFromMimeParts(payload.parts, gmailMessageId));
  }
  
  return attachments;
}

function deriveSnippet(bodyText, maxLength = 140) {
  if (!bodyText) return '';
  let snippet = bodyText.trim();
  if (snippet.length > maxLength) {
    snippet = snippet.substring(0, maxLength) + '…';
  }
  return snippet;
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const requestBody = bodyText ? JSON.parse(bodyText) : {};
    const { gmail_thread_id } = requestBody;

    if (!gmail_thread_id) {
      return Response.json(
        { error: 'Missing required field: gmail_thread_id' },
        { status: 400 }
      );
    }

    console.log(`[gmailSyncThreadMessages] Syncing thread: ${gmail_thread_id}`);

    // Fetch thread with full message details
    const threadDetail = await gmailFetch(
      `/gmail/v1/users/me/threads/${gmail_thread_id}`,
      'GET',
      null,
      { format: 'full' }
    );

    if (!threadDetail.messages || threadDetail.messages.length === 0) {
      return Response.json({ success: true, syncedCount: 0, okCount: 0, partialCount: 0, failedCount: 0, failures: [] });
    }

    // Find or create EmailThread
    const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id: gmail_thread_id
    });

    let threadId = null;
    if (existingThreads.length > 0) {
      threadId = existingThreads[0].id;
    } else {
      // Create minimal EmailThread
      const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
      const lastHeaders = {};
      if (lastMsg.payload?.headers) {
        lastMsg.payload.headers.forEach(h => {
          lastHeaders[h.name.toLowerCase()] = h.value;
        });
      }

      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        subject: lastHeaders['subject'] || '(no subject)',
        gmail_thread_id: gmail_thread_id,
        from_address: lastHeaders['from'] || '',
        to_addresses: lastHeaders['to'] ? lastHeaders['to'].split(',').map(e => e.trim()) : [],
        last_message_date: new Date().toISOString(),
        message_count: threadDetail.messages.length
      });
      threadId = newThread.id;
    }

    // Process messages with tracking
    let syncedCount = 0;
    let okCount = 0;
    let partialCount = 0;
    let failedCount = 0;
    const failures = [];

    const now = new Date().toISOString();

    for (const gmailMsg of threadDetail.messages) {
      let parseError = null;

      try {
        const headers = {};
        if (gmailMsg.payload?.headers) {
          gmailMsg.payload.headers.forEach(h => {
            headers[h.name.toLowerCase()] = h.value;
          });
        }

        // Extract body with robust MIME parsing
        let incomingResult = extractBodyFromPayload(gmailMsg.payload);
        
        // Extract attachments (added 2026-01-29)
        const incomingAttachments = extractAttachmentsFromPayload(gmailMsg.payload, gmailMsg.id);

        // Check if message already exists
        const existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: gmailMsg.id
        });

        const existing = existingMessages[0] || null;

        // Coalesce bodies: never overwrite non-empty with empty
        const mergedBody = coalesceBody(existing, incomingResult);
        const finalHasBody = hasBodyTruth(mergedBody.body_html, mergedBody.body_text);

        // Compute sync_status
        // Rule: if incoming parse succeeded (no error), use computeSyncStatus
        // Rule: if existing had body and incoming is empty, mark as "partial" (preserve existing)
        // Rule: never downgrade from existing status
        let syncStatus = 'ok';
        if (!incomingResult.body_html && !incomingResult.body_text) {
          if (existing?.body_html || existing?.body_text) {
            // Incoming is empty but existing has body: preserve as partial
            syncStatus = 'partial';
            parseError = 'body_missing_in_latest_fetch; preserving_previous_body';
          } else {
            // Never had body
            syncStatus = 'failed';
            parseError = 'body_missing_no_previous_body';
          }
        } else {
          syncStatus = finalHasBody ? 'ok' : 'partial';
        }

        // Never downgrade sync_status
        if (existing?.sync_status === 'ok' && syncStatus !== 'ok') {
          syncStatus = existing.sync_status;
        }

        // Never set has_body to false if it was true
        const finalHasBodyForRecord = existing?.has_body === true ? true : finalHasBody;

        // Prevent regression: log if we would have overwritten
        if (existing && mergedBody.body_html !== incomingResult.body_html) {
          if (incomingResult.body_html === '' && existing.body_html) {
            console.log(
              `[gmailSyncThreadMessages] prevented_regression: ${gmailMsg.id} ` +
              `(preserved existing body_html, incoming was empty)`
            );
          }
        }
        if (existing && mergedBody.body_text !== incomingResult.body_text) {
          if (incomingResult.body_text === '' && existing.body_text) {
            console.log(
              `[gmailSyncThreadMessages] prevented_regression: ${gmailMsg.id} ` +
              `(preserved existing body_text, incoming was empty)`
            );
          }
        }

        // Merge attachments: preserve existing if incoming is empty (guardrail against regression)
        let finalAttachments = incomingAttachments;
        if (existing?.attachments?.length > 0 && incomingAttachments.length === 0) {
          console.log(`[gmailSyncThreadMessages] preserved_attachments: ${gmailMsg.id} (incoming empty, kept ${existing.attachments.length} existing)`);
          finalAttachments = existing.attachments;
        }

        const messageData = {
          thread_id: threadId,
          gmail_message_id: gmailMsg.id,
          gmail_thread_id: gmail_thread_id,
          from_address: headers['from'] || '',
          from_name: headers['from'] || '',
          to_addresses: headers['to'] ? headers['to'].split(',').map(e => e.trim()) : [],
          cc_addresses: headers['cc'] ? headers['cc'].split(',').map(e => e.trim()) : [],
          subject: headers['subject'] || '',
          body_html: mergedBody.body_html,
          body_text: mergedBody.body_text,
          sent_at: headers['date'] ? new Date(headers['date']).toISOString() : new Date().toISOString(),
          is_outbound: headers['from']?.includes('kangaroogd.com.au') || false,
          attachments: finalAttachments,
          has_body: finalHasBodyForRecord,
          sync_status: syncStatus,
          parse_error: syncStatus === 'ok' ? null : parseError,
          last_synced_at: now
        };

        if (existing) {
          await base44.asServiceRole.entities.EmailMessage.update(existing.id, messageData);
        } else {
          await base44.asServiceRole.entities.EmailMessage.create(messageData);
        }

        // Track counts
        if (syncStatus === 'ok') okCount++;
        else if (syncStatus === 'partial') partialCount++;
        else failedCount++;

        if (syncStatus !== 'ok') {
          failures.push({ 
            gmail_message_id: gmailMsg.id, 
            status: syncStatus,
            reason: parseError 
          });
        }

        syncedCount++;
      } catch (err) {
        console.error(`[gmailSyncThreadMessages] Error processing message ${gmailMsg.id}:`, err.message);
        failedCount++;
        failures.push({ gmail_message_id: gmailMsg.id, reason: err.message });
      }
    }

    // Update thread snippet from latest message
    try {
      const latestMessages = await base44.asServiceRole.entities.EmailMessage.filter({
        thread_id: threadId,
        has_body: true
      });

      if (latestMessages.length > 0) {
        // Sort by sent_at, get latest
        latestMessages.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
        const latestMsg = latestMessages[0];
        const snippet = latestMsg.body_text ? deriveSnippet(latestMsg.body_text) : '';

        await base44.asServiceRole.entities.EmailThread.update(threadId, {
          snippet: snippet,
          has_preview: !!snippet
        });
      }
    } catch (err) {
      console.error('[gmailSyncThreadMessages] Error updating thread snippet:', err.message);
    }

    console.log(`[gmailSyncThreadMessages] Complete: synced=${syncedCount}, ok=${okCount}, partial=${partialCount}, failed=${failedCount}`);

    return Response.json({
      success: true,
      syncedCount,
      okCount,
      partialCount,
      failedCount,
      failures
    });
  } catch (error) {
    console.error('[gmailSyncThreadMessages] Fatal error:', error.message);
    return Response.json(
      { error: error.message, syncedCount: 0, okCount: 0, partialCount: 0, failedCount: 0, failures: [] },
      { status: 500 }
    );
  }
});