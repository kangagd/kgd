import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { persistAttachmentsToEntity } from './shared/emailAttachmentPersistence.ts';
import { normalizeUtf8, hasEncodingCorruption } from './shared/utf8Normalizer.ts';

// Helper to wrap base64 data to 76 chars per line (RFC-friendly)
function wrapBase64(base64Data, lineLength = 76) {
  const chunks = [];
  for (let i = 0; i < base64Data.length; i += lineLength) {
    chunks.push(base64Data.substring(i, i + lineLength));
  }
  return chunks.join('\r\n');
}

// Helper to build RFC 2822 MIME message with attachments
function buildMimeMessage({ from, to, cc, bcc, subject, textBody, htmlBody, inReplyTo, references, threadId, attachments }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const alternativeBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const relatedBoundary = `----=_Rel_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const lines = [];

  // Ensure arrays
  const toArray = Array.isArray(to) ? to : (to ? [to] : []);
  const ccArray = Array.isArray(cc) ? cc : (cc ? [cc] : []);
  const bccArray = Array.isArray(bcc) ? bcc : (bcc ? [bcc] : []);
  const attachmentArray = Array.isArray(attachments) ? attachments : [];
  
  // Separate inline (CID) vs regular attachments
  const inlineAttachments = attachmentArray.filter(att => att.is_inline === true || att.contentId);
  const regularAttachments = attachmentArray.filter(att => !att.is_inline && !att.contentId);

  // Headers
  lines.push(`From: ${from}`);
  if (toArray.length > 0) lines.push(`To: ${toArray.join(', ')}`);
  if (ccArray.length > 0) lines.push(`Cc: ${ccArray.join(', ')}`);
  if (bccArray.length > 0) lines.push(`Bcc: ${bccArray.join(', ')}`);
  lines.push(`Subject: ${subject}`);
  
  // Thread headers for replies
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  
  lines.push('MIME-Version: 1.0');
  
  // Determine structure based on attachment types
  const hasInline = inlineAttachments.length > 0;
  const hasRegular = regularAttachments.length > 0;
  
  if (hasRegular || hasInline) {
    // Use multipart/mixed as top container
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    
    // Body part (with inline images if present)
    lines.push(`--${boundary}`);
    
    if (hasInline) {
      // Use multipart/related to group HTML + inline images
      lines.push(`Content-Type: multipart/related; boundary="${relatedBoundary}"`);
      lines.push('');
      
      // Alternative part (text + HTML)
      lines.push(`--${relatedBoundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
      lines.push('');
      
      // Plain text
      lines.push(`--${alternativeBoundary}`);
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(textBody || htmlBody.replace(/<[^>]*>/g, ''));
      lines.push('');
      
      // HTML (references cid:contentId)
      lines.push(`--${alternativeBoundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(htmlBody);
      lines.push('');
      lines.push(`--${alternativeBoundary}--`);
      
      // Inline images (CID attachments)
      for (const att of inlineAttachments) {
        if (!att.data || !att.filename) continue;
        
        lines.push(`--${relatedBoundary}`);
        lines.push(`Content-Type: ${att.mimeType || 'application/octet-stream'}`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: inline; filename="${att.filename}"`);
        if (att.contentId) {
          lines.push(`Content-ID: <${att.contentId}>`);
        }
        lines.push('');
        
        // Clean and wrap base64
        let base64Data = att.data;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        lines.push(wrapBase64(base64Data));
        lines.push('');
      }
      
      lines.push(`--${relatedBoundary}--`);
    } else if (htmlBody) {
      // Regular attachments only - no inline images
      lines.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
      lines.push('');
      
      // Plain text
      lines.push(`--${alternativeBoundary}`);
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(textBody || htmlBody.replace(/<[^>]*>/g, ''));
      lines.push('');
      
      // HTML
      lines.push(`--${alternativeBoundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(htmlBody);
      lines.push('');
      lines.push(`--${alternativeBoundary}--`);
    } else {
      // Text only body
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(textBody);
      lines.push('');
    }
    } else if (htmlBody) {
      // No inline images, just text + HTML
      lines.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
      lines.push('');
      
      // Plain text
      lines.push(`--${alternativeBoundary}`);
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(textBody || htmlBody.replace(/<[^>]*>/g, ''));
      lines.push('');
      
      // HTML
      lines.push(`--${alternativeBoundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(htmlBody);
      lines.push('');
      lines.push(`--${alternativeBoundary}--`);
    } else {
      // Text only
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(textBody);
      lines.push('');
    }
    
    // Regular attachments (not inline)
    for (const att of regularAttachments) {
      if (!att.data || !att.filename) continue;
      
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.mimeType || 'application/octet-stream'}`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push('');
      
      // Clean and wrap base64
      let base64Data = att.data;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      lines.push(wrapBase64(base64Data));
      lines.push('');
    }
    
    lines.push(`--${boundary}--`);
  } else if (htmlBody) {
    // No attachments, HTML + text
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    
    // Plain text
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(textBody || htmlBody.replace(/<[^>]*>/g, ''));
    lines.push('');
    
    // HTML
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(htmlBody);
    lines.push('');
    lines.push(`--${boundary}--`);
  } else {
    // Plain text only
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(textBody);
  }

  return lines.join('\r\n');
}

// Base64url encoding
function base64UrlEncode(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Retry with exponential backoff for rate limits
async function retryWithBackoff(fn, maxRetries = 4) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Only retry on 429 rate limit errors
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  throw lastError;
}

// Helper to get Gmail access token using service account
async function getGmailAccessToken() {
  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');
    
    if (!serviceAccountJson || !impersonateEmail) {
      throw new Error('Service account credentials not configured');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT for service account
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const jwtClaim = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      sub: impersonateEmail,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const message = `${jwtHeader}.${jwtClaim}`;
    
    // Sign with private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      Uint8Array.from(atob(serviceAccount.private_key.replace(/-----.*?-----/g, '').replace(/\n/g, '')), c => c.charCodeAt(0)),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(message)
    );
    
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      .replace(/\s/g, ''); // Remove any whitespace
    
    const jwt = `${message}.${signatureBase64}`;
    
    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
    }
    
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    throw new Error(`Failed to get Gmail access token: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      rawMimeBase64Url, 
      gmailDraftId, 
      from, 
      to, 
      cc, 
      bcc, 
      subject, 
      textBody, 
      htmlBody, 
      body_html,
      body_text,
      thread_id,
      gmail_thread_id,
      inReplyTo, 
      references,
      attachments,
      project_id,
      project_name,
      contract_id,
      // Project-sent email context
      source_context,
      origin,
      project_customer_id,
      project_address,
      email_thread_id,
      // Idempotency params
      draft_id,
      content_hash
    } = await req.json();

    // GUARDRAIL: If origin="project", project_id is required
    if (origin === "project" && !project_id) {
      return Response.json(
        { error: 'project_id is required when origin="project"' },
        { status: 400 }
      );
    }

    // Validate attachments (size + structure)
    if (attachments && Array.isArray(attachments)) {
      const totalSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);
      const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
      
      if (totalSize > MAX_ATTACHMENT_SIZE) {
        return Response.json({
          success: false,
          error: 'ATTACHMENTS_TOO_LARGE',
          message: `Total attachment size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds 20MB limit`
        }, { status: 400 });
      }

      // Validate each attachment has required fields (allow extra fields for inline attachments)
      for (const att of attachments) {
        if (!att.filename || !att.mimeType || !att.data) {
          return Response.json({
            success: false,
            error: 'INVALID_ATTACHMENT',
            message: 'Each attachment must have filename, mimeType, and data'
          }, { status: 400 });
        }
        // Note: is_inline and contentId are optional extra fields for CID attachments
      }
    }

    // Resolve project_id/contract_id: explicit payload takes priority over thread inheritance
    let resolvedProjectId = project_id;
    let resolvedContractId = contract_id;
    let threadLinkConflict = false;
    
    if (thread_id && !resolvedProjectId && !resolvedContractId) {
      try {
        const thread = await base44.asServiceRole.entities.EmailThread.get(thread_id);
        if (thread) {
          // Conflict detection: thread already linked to different entity
          if (project_id && thread.project_id && thread.project_id !== project_id) {
            threadLinkConflict = true;
            console.warn(`[gmailSendEmail] Conflict: thread ${thread_id} linked to project ${thread.project_id}, payload wants ${project_id}`);
          }
          if (contract_id && thread.contract_id && thread.contract_id !== contract_id) {
            threadLinkConflict = true;
            console.warn(`[gmailSendEmail] Conflict: thread ${thread_id} linked to contract ${thread.contract_id}, payload wants ${contract_id}`);
          }
          
          // Inherit if not explicitly provided
          if (thread.contract_id) {
            resolvedContractId = thread.contract_id;
            console.log(`[gmailSendEmail] Inherited contract_id=${resolvedContractId} from thread`);
          } else if (thread.project_id) {
            resolvedProjectId = thread.project_id;
            console.log(`[gmailSendEmail] Inherited project_id=${resolvedProjectId} from thread`);
          }
        }
      } catch (err) {
        console.error('[gmailSendEmail] Failed to load thread for inheritance:', err.message);
        // Continue without inheritance (non-blocking)
      }
    }

    // Normalize body fields: use canonical body_html/body_text with backwards-compat
    const canonicalBodyHtml = body_html ?? htmlBody ?? '';
    const canonicalBodyText = body_text ?? textBody ?? '';
    
    // Soft warning if old field names used without canonical ones
    if ((htmlBody || textBody) && !body_html && !body_text) {
      console.warn('[gmailSendEmail] Deprecated: htmlBody/textBody used; prefer body_html/body_text');
    }

    // Get Service Account credentials
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

    if (!serviceAccountJson || !impersonateEmail) {
      return Response.json({ error: 'Gmail credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_IMPERSONATE_USER_EMAIL' }, { status: 500 });
    }

    // IDEMPOTENCY CHECK: If draft_id + content_hash provided, check for existing sent attempt
    if (draft_id && content_hash) {
      try {
        const existingAttempts = await base44.asServiceRole.entities.EmailSendAttempt.filter({
          draft_id,
          content_hash,
          status: 'sent'
        });

        if (existingAttempts.length > 0) {
          const existingAttempt = existingAttempts[0];
          console.log(`[gmailSendEmail] Idempotent send detected - email already sent (attempt_id: ${existingAttempt.attempt_id})`);
          return Response.json({
            success: true,
            idempotent: true,
            gmailMessageId: existingAttempt.gmail_message_id,
            gmailThreadId: existingAttempt.thread_id,
            attempt_id: existingAttempt.attempt_id,
            message: 'Email already sent (idempotent)'
          });
        }
      } catch (err) {
        console.error('[gmailSendEmail] Error checking existing send attempts:', err.message);
        // Continue with send on error (fail-open)
      }
    }

    // Create new send attempt record (status: sending)
    let attemptId = null;
    if (draft_id && content_hash) {
      try {
        const attempt = await base44.asServiceRole.entities.EmailSendAttempt.create({
          draft_id,
          content_hash,
          compose_context_key: '', // Optional field, can be populated from draft
          status: 'sending',
          attempt_id: crypto.randomUUID(),
        });
        attemptId = attempt.id;
        console.log(`[gmailSendEmail] Created send attempt ${attemptId}`);
      } catch (err) {
        console.error('[gmailSendEmail] Failed to create send attempt:', err.message);
        // Continue without attempt tracking (non-blocking)
      }
    }

    // Get access token using service account
    let accessToken;
    try {
      accessToken = await getGmailAccessToken();
      console.log('[gmailSendEmail] Access token obtained');
    } catch (tokenError) {
      console.error('[gmailSendEmail] Failed to get access token:', tokenError.message);
      
      // Update attempt to failed if exists
      if (attemptId) {
        try {
          await base44.asServiceRole.entities.EmailSendAttempt.update(attemptId, {
            status: 'failed',
            error_code: 'AUTH_FAILED',
            error_message: tokenError.message
          });
        } catch (err) {
          console.error('[gmailSendEmail] Failed to update attempt status:', err.message);
        }
      }
      
      throw new Error(`Authentication failed: ${tokenError.message}`);
    }

    let result;

    if (gmailDraftId) {
      // Send existing draft
      console.log(`[gmailSendEmail] Sending draft ${gmailDraftId} for user ${user.email}`);
      result = await retryWithBackoff(async () => {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftId}/send`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[gmailSendEmail] Draft send failed (${response.status}):`, errorText);
          throw new Error(`Gmail API error (${response.status}): ${errorText}`);
        }

        return await response.json();
      });
    } else {
      // ===== FINAL UTF-8 NORMALIZATION BOUNDARY (before Gmail API) =====
      const finalizedSubject = normalizeUtf8(subject || '');
      const finalizedBodyHtml = normalizeUtf8(canonicalBodyHtml);
      const finalizedBodyText = normalizeUtf8(canonicalBodyText);

      // DEBUG GUARDRAIL: Log if corruption detected
      if (hasEncodingCorruption(finalizedBodyHtml) || hasEncodingCorruption(finalizedBodyText)) {
        console.warn(`[gmailSendEmail UTF8] Encoding corruption detected in outbound email (origin=${origin}, project_id=${project_id})`);
      }

      // Build and send new message
       let encodedMessage = rawMimeBase64Url;
       if (!encodedMessage) {
         const mimeMessage = buildMimeMessage({
                from: from || user.email,
                to: to || [],
                cc,
                bcc,
                subject: finalizedSubject,
                textBody: finalizedBodyText,
                htmlBody: finalizedBodyHtml,
                inReplyTo,
                references,
                threadId: thread_id || gmail_thread_id,
                attachments: attachments || []
              });

              // Ensure body is not empty
                    if (!finalizedSubject || !to || to.length === 0) {
                      throw new Error('Subject and at least one recipient (To) are required');
                    }

                    if (!(finalizedBodyHtml || finalizedBodyText).trim()) {
                      throw new Error('Message body cannot be empty');
                    }

              encodedMessage = base64UrlEncode(mimeMessage);
       }

      const sendPayload = {
        raw: encodedMessage
      };

      // Only add threadId if we have a valid Gmail thread ID (not our internal thread_id)
      if (!rawMimeBase64Url && gmail_thread_id) {
        sendPayload.threadId = gmail_thread_id;
      }

      result = await retryWithBackoff(async () => {
        const response = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sendPayload)
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Gmail API error (${response.status}): ${error}`);
        }

        return await response.json();
      });
    }

    // Resolve or create EmailThread for outbound email
    let resolvedThreadId = thread_id || email_thread_id;

    // ============================================================================
    // IMMEDIATE LINKING: Link sent emails to Project/Contract at send time
    // When origin="project", link immediately via deterministic upsert
    // ============================================================================
    if (result.threadId && (resolvedProjectId || resolvedContractId)) {
      try {
        // Check for existing EmailThread with same gmail_thread_id
        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: result.threadId
        });

        if (existingThreads.length > 0) {
          // Reuse existing thread and update linking if needed (guardrail: never overwrite)
          resolvedThreadId = existingThreads[0].id;
          const thread = existingThreads[0];
          const updateData = {};

          if (resolvedContractId && !thread.contract_id) {
            updateData.contract_id = resolvedContractId;
            updateData.linked_to_contract_at = new Date().toISOString();
            updateData.linked_to_contract_by = user.email;
          } else if (resolvedProjectId && !thread.project_id) {
            // Only link to project if contract not present
            updateData.project_id = resolvedProjectId;
            updateData.linked_to_project_at = new Date().toISOString();
            updateData.linked_to_project_by = user.email;
          }

          if (Object.keys(updateData).length > 0) {
            await base44.asServiceRole.entities.EmailThread.update(resolvedThreadId, updateData);
            console.log(`[gmailSendEmail] Reused and updated existing thread ${resolvedThreadId} with linking`);
          } else {
            console.log(`[gmailSendEmail] Reused existing thread ${resolvedThreadId} (no linking needed)`);
          }
        } else {
          // Create new EmailThread with project/contract linking
          const newThread = await base44.asServiceRole.entities.EmailThread.create({
            gmail_thread_id: result.threadId,
            subject: subject || '(no subject)',
            from_address: from || user.email,
            to_addresses: to || [],
            last_message_date: new Date().toISOString(),
            lastMessageDirection: 'sent',
            message_count: 1,
            // Linking: prefer contract, fallback to project
            ...(resolvedContractId && { contract_id: resolvedContractId }),
            ...(resolvedProjectId && !resolvedContractId && { project_id: resolvedProjectId }),
            // Track linking metadata
            ...(resolvedContractId && {
              linked_to_contract_at: new Date().toISOString(),
              linked_to_contract_by: user.email
            }),
            ...(resolvedProjectId && !resolvedContractId && {
              linked_to_project_at: new Date().toISOString(),
              linked_to_project_by: user.email
            })
          });

          resolvedThreadId = newThread.id;
          console.log(`[gmailSendEmail] Created new thread ${resolvedThreadId} with ${resolvedContractId ? 'contract' : 'project'} linking`);
        }
      } catch (error) {
        console.error('[gmailSendEmail] Error resolving/creating EmailThread for outbound email:', error.message);
        // Continue without thread linking (not blocking send)
      }
    }

    // Create or upsert EmailMessage record for sent email (idempotent by gmail_message_id)
    let emailMessageId = null;
    if (resolvedThreadId) {
      try {
        // Idempotent upsert: try to get existing message by gmail_message_id first
        const existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: result.id
        });

        let createdMessage;
        if (existingMessages.length > 0) {
          // Message already exists; use it
          createdMessage = existingMessages[0];
          console.log(`[gmailSendEmail] Reused existing EmailMessage ${createdMessage.id}`);
        } else {
          // Create new message
          createdMessage = await base44.asServiceRole.entities.EmailMessage.create({
             thread_id: resolvedThreadId,
             gmail_message_id: result.id,
             gmail_thread_id: result.threadId || gmail_thread_id,
             from_address: from || user.email,
             to_addresses: to || [],
             cc_addresses: cc || [],
             bcc_addresses: bcc || [],
             subject: finalizedSubject,
             body_html: finalizedBodyHtml,
             body_text: finalizedBodyText || finalizedBodyHtml.replace(/<[^>]*>/g, ''),
             is_outbound: true,
             sent_at: new Date().toISOString(),
             performed_by_user_id: user.id,
             performed_by_user_email: user.email,
             performed_at: new Date().toISOString(),
             // Link to project/contract if provided (deterministic linking at send time)
             ...(resolvedProjectId && { project_id: resolvedProjectId }),
             ...(resolvedContractId && { contract_id: resolvedContractId })
           });
          console.log(`[gmailSendEmail] Created new EmailMessage ${createdMessage.id}`);
        }
        emailMessageId = createdMessage.id;

        // Update thread last_message_date + auto-link to Project/Contract if provided (for existing threads)
        if (thread_id) {
          // Only update if we had a pre-existing thread_id (existing behavior)
          const thread = await base44.asServiceRole.entities.EmailThread.get(resolvedThreadId);
          if (thread) {
            const updateData = {
              last_message_date: new Date().toISOString(),
              lastMessageDirection: 'sent'
            };

            // Safe linking: only set if not already linked (GUARDRAIL #1: never overwrite existing non-null link)
            if (resolvedProjectId && !thread.project_id) {
              updateData.project_id = resolvedProjectId;
              updateData.linked_to_project_at = new Date().toISOString();
              updateData.linked_to_project_by = user.email;
            }

            if (resolvedContractId && !thread.contract_id) {
              updateData.contract_id = resolvedContractId;
              updateData.linked_to_contract_at = new Date().toISOString();
              updateData.linked_to_contract_by = user.email;
            }

            if (Object.keys(updateData).length > 2) { // More than just last_message_date and lastMessageDirection
              await base44.asServiceRole.entities.EmailThread.update(resolvedThreadId, updateData);
            }
          }
        }
      } catch (error) {
        console.error('Error creating EmailMessage record or updating thread linking:', error);
      }
    }

    // Persist attachments to linked Project/Contract (best-effort, non-blocking)
    let attachmentPersistResult = null;
    if (resolvedThreadId && attachments && attachments.length > 0) {
      try {
        const thread = await base44.asServiceRole.entities.EmailThread.get(resolvedThreadId);
        if (thread) {
          // Determine link target: prefer contract_id, fallback to project_id
          const targetContractId = resolvedContractId || thread.contract_id;
          const targetProjectId = resolvedProjectId || thread.project_id;
          
          if (targetContractId) {
            // Persist to Contract
            attachmentPersistResult = await persistAttachmentsToEntity({
              base44,
              entityType: 'contract',
              entityId: targetContractId,
              threadId: resolvedThreadId,
              messageId: emailMessageId,
              attachments
            });
            console.log(`[gmailSendEmail] Attachment persist to contract: ${JSON.stringify(attachmentPersistResult)}`);
          } else if (targetProjectId) {
            // Persist to Project
            attachmentPersistResult = await persistAttachmentsToEntity({
              base44,
              entityType: 'project',
              entityId: targetProjectId,
              threadId: resolvedThreadId,
              messageId: emailMessageId,
              attachments
            });
            console.log(`[gmailSendEmail] Attachment persist to project: ${JSON.stringify(attachmentPersistResult)}`);
          }
        }
      } catch (error) {
        console.error('[gmailSendEmail] Error persisting attachments:', error.message);
        // Do not throw; attachment persistence is best-effort
      }
    }

    // Trigger immediate Gmail sync for the thread to ensure sent message is synced back
    // (best-effort, non-blocking - doesn't delay response)
    if (result.threadId) {
      try {
        base44.functions.invoke('gmailSyncThreadMessages', {
          gmail_thread_id: result.threadId
        }).catch(err => {
          console.error('[gmailSendEmail] Async sync failed:', err.message);
          // Non-blocking failure
        });
      } catch (err) {
        console.error('[gmailSendEmail] Failed to invoke async sync:', err.message);
        // Non-blocking failure
      }
    }

    // Update send attempt to sent (if exists)
    if (attemptId) {
      try {
        await base44.asServiceRole.entities.EmailSendAttempt.update(attemptId, {
          status: 'sent',
          gmail_message_id: result.id,
        });
        console.log(`[gmailSendEmail] Updated send attempt ${attemptId} to sent`);
      } catch (err) {
        console.error('[gmailSendEmail] Failed to update attempt to sent:', err.message);
      }
    }

    return Response.json({
      success: true,
      gmailMessageId: result.id,
      gmailThreadId: result.threadId,
      email_thread_id: resolvedThreadId,
      email_message_id: emailMessageId,
      baseThreadId: resolvedThreadId,
      project_id: resolvedProjectId,
      contract_id: resolvedContractId,
      labelIds: result.labelIds,
      attachment_persist: attachmentPersistResult,
      attempt_id: attemptId,
      thread_link_conflict: threadLinkConflict
    });

  } catch (error) {
    console.error('[gmailSendEmail] Error:', error.message);
    if (error.stack) console.error('[gmailSendEmail] Stack:', error.stack);
    
    // Update send attempt to failed (if exists)
    if (attemptId) {
      try {
        await base44.asServiceRole.entities.EmailSendAttempt.update(attemptId, {
          status: 'failed',
          error_code: 'SEND_FAILED',
          error_message: error.message || 'Failed to send email'
        });
      } catch (err) {
        console.error('[gmailSendEmail] Failed to update attempt to failed:', err.message);
      }
    }
    
    return Response.json({ 
      error: error.message || 'Failed to send email'
    }, { status: 500 });
  }
});