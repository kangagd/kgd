import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { persistAttachmentsToEntity } from './shared/emailAttachmentPersistence.js';

// Helper to build RFC 2822 MIME message with attachments
function buildMimeMessage({ from, to, cc, bcc, subject, textBody, htmlBody, inReplyTo, references, threadId, attachments }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const alternativeBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const lines = [];

  // Ensure arrays
  const toArray = Array.isArray(to) ? to : (to ? [to] : []);
  const ccArray = Array.isArray(cc) ? cc : (cc ? [cc] : []);
  const bccArray = Array.isArray(bcc) ? bcc : (bcc ? [bcc] : []);
  const attachmentArray = Array.isArray(attachments) ? attachments : [];

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
  
  // If we have attachments, use multipart/mixed
  if (attachmentArray.length > 0) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    
    // Body part (multipart/alternative if both text and HTML, otherwise just text or HTML)
    lines.push(`--${boundary}`);
    
    if (htmlBody) {
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
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(textBody);
      lines.push('');
    }
    
    // Attachments
    for (const att of attachmentArray) {
      if (!att.data || !att.filename) continue;
      
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.mimeType || 'application/octet-stream'}`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push('');
      
      // Ensure data is clean base64 (no prefix)
      let base64Data = att.data;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      lines.push(base64Data);
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
      contract_id,
      // Project-sent email context
      origin,
      project_customer_id,
      project_address,
      email_thread_id
    } = await req.json();

    // GUARDRAIL: If origin="project", project_id is required
    if (origin === "project" && !project_id) {
      return Response.json(
        { error: 'project_id is required when origin="project"' },
        { status: 400 }
      );
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

    // Get access token using service account
    let accessToken;
    try {
      accessToken = await getGmailAccessToken();
      console.log('[gmailSendEmail] Access token obtained');
    } catch (tokenError) {
      console.error('[gmailSendEmail] Failed to get access token:', tokenError.message);
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
      // Build and send new message
       let encodedMessage = rawMimeBase64Url;
       if (!encodedMessage) {
         const mimeMessage = buildMimeMessage({
                from: from || user.email,
                to: to || [],
                cc,
                bcc,
                subject: subject || '',
                textBody: canonicalBodyText,
                htmlBody: canonicalBodyHtml,
                inReplyTo,
                references,
                threadId: thread_id || gmail_thread_id,
                attachments: attachments || []
              });

              // Ensure body is not empty
              if (!subject || !to || to.length === 0) {
                throw new Error('Subject and at least one recipient (To) are required');
              }

              if (!(canonicalBodyHtml || canonicalBodyText).trim()) {
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
    if (result.threadId && (project_id || contract_id)) {
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

          if (contract_id && !thread.contract_id) {
            updateData.contract_id = contract_id;
            updateData.linked_to_contract_at = new Date().toISOString();
            updateData.linked_to_contract_by = user.email;
          } else if (project_id && !thread.project_id) {
            // Only link to project if contract not present
            updateData.project_id = project_id;
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
            ...(contract_id && { contract_id }),
            ...(project_id && !contract_id && { project_id }),
            // Track linking metadata
            ...(contract_id && {
              linked_to_contract_at: new Date().toISOString(),
              linked_to_contract_by: user.email
            }),
            ...(project_id && !contract_id && {
              linked_to_project_at: new Date().toISOString(),
              linked_to_project_by: user.email
            })
          });

          resolvedThreadId = newThread.id;
          console.log(`[gmailSendEmail] Created new thread ${resolvedThreadId} with ${contract_id ? 'contract' : 'project'} linking`);
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
             subject: subject || '',
             body_html: canonicalBodyHtml,
             body_text: canonicalBodyText || canonicalBodyHtml.replace(/<[^>]*>/g, ''),
             is_outbound: true,
             sent_at: new Date().toISOString(),
             performed_by_user_id: user.id,
             performed_by_user_email: user.email,
             performed_at: new Date().toISOString(),
             // Link to project/contract if provided (deterministic linking at send time)
             ...(project_id && { project_id }),
             ...(contract_id && { contract_id })
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
            if (project_id && !thread.project_id) {
              updateData.project_id = project_id;
              updateData.linked_to_project_at = new Date().toISOString();
              updateData.linked_to_project_by = user.email;
            }

            if (contract_id && !thread.contract_id) {
              updateData.contract_id = contract_id;
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
          const targetContractId = contract_id || thread.contract_id;
          const targetProjectId = project_id || thread.project_id;
          
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

    return Response.json({
      success: true,
      gmailMessageId: result.id,
      gmailThreadId: result.threadId,
      email_thread_id: resolvedThreadId,
      email_message_id: emailMessageId,
      baseThreadId: resolvedThreadId,
      project_id,
      labelIds: result.labelIds,
      attachment_persist: attachmentPersistResult
    });

  } catch (error) {
    console.error('[gmailSendEmail] Error:', error.message);
    if (error.stack) console.error('[gmailSendEmail] Stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Failed to send email'
    }, { status: 500 });
  }
});