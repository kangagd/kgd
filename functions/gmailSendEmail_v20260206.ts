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
      source_context,
      origin,
      project_customer_id,
      project_address,
      email_thread_id,
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

    // Validate attachments
    if (attachments && Array.isArray(attachments)) {
      const totalSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);
      const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
      
      if (totalSize > MAX_ATTACHMENT_SIZE) {
        return Response.json({
          success: false,
          error: 'ATTACHMENTS_TOO_LARGE',
          message: `Total attachment size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds 20MB limit`
        }, { status: 400 });
      }

      for (const att of attachments) {
        if (!att.filename || !att.mimeType || !att.data) {
          return Response.json({
            success: false,
            error: 'INVALID_ATTACHMENT',
            message: 'Each attachment must have filename, mimeType, and data'
          }, { status: 400 });
        }
      }
    }

    // Resolve project_id/contract_id
    let resolvedProjectId = project_id;
    let resolvedContractId = contract_id;
    
    if (thread_id && !resolvedProjectId && !resolvedContractId) {
      try {
        const thread = await base44.asServiceRole.entities.EmailThread.get(thread_id);
        if (thread) {
          if (thread.contract_id) {
            resolvedContractId = thread.contract_id;
          } else if (thread.project_id) {
            resolvedProjectId = thread.project_id;
          }
        }
      } catch (err) {
        console.error('[gmailSendEmail_v20260206] Failed to load thread:', err.message);
      }
    }

    // Normalize body fields
    const canonicalBodyHtml = body_html ?? htmlBody ?? '';
    const canonicalBodyText = body_text ?? textBody ?? '';

    // IDEMPOTENCY CHECK
    if (draft_id && content_hash) {
      try {
        const existingAttempts = await base44.asServiceRole.entities.EmailSendAttempt.filter({
          draft_id,
          content_hash,
          status: 'sent'
        });

        if (existingAttempts.length > 0) {
          const existingAttempt = existingAttempts[0];
          console.log(`[gmailSendEmail_v20260206] Email already sent (idempotent)`);
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
        console.error('[gmailSendEmail_v20260206] Error checking attempts:', err.message);
      }
    }

    // Create send attempt
    let attemptId = null;
    if (draft_id && content_hash) {
      try {
        const attempt = await base44.asServiceRole.entities.EmailSendAttempt.create({
          draft_id,
          content_hash,
          compose_context_key: '',
          status: 'sending',
          attempt_id: crypto.randomUUID(),
        });
        attemptId = attempt.id;
      } catch (err) {
        console.error('[gmailSendEmail_v20260206] Failed to create attempt:', err.message);
      }
    }

    // Get access token from app connector
    let accessToken;
    try {
      accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");
      console.log('[gmailSendEmail_v20260206] Got token from app connector');
    } catch (tokenError) {
      console.error('[gmailSendEmail_v20260206] Token error:', tokenError.message);
      
      if (attemptId) {
        try {
          await base44.asServiceRole.entities.EmailSendAttempt.update(attemptId, {
            status: 'failed',
            error_code: 'AUTH_FAILED',
            error_message: tokenError.message
          });
        } catch (err) {
          console.error('[gmailSendEmail_v20260206] Failed to update attempt:', err.message);
        }
      }
      
      throw new Error(`Authentication failed: ${tokenError.message}`);
    }

    let result;

    if (gmailDraftId) {
      // Send existing draft
      console.log(`[gmailSendEmail_v20260206] Sending draft ${gmailDraftId}`);
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
        console.error(`[gmailSendEmail_v20260206] Draft send failed (${response.status}):`, errorText);
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      result = await response.json();
    } else {
      // UTF-8 normalization
      const finalizedSubject = normalizeUtf8(subject || '');
      const finalizedBodyHtml = normalizeUtf8(canonicalBodyHtml);
      const finalizedBodyText = normalizeUtf8(canonicalBodyText);

      if (hasEncodingCorruption(finalizedBodyHtml) || hasEncodingCorruption(finalizedBodyText)) {
        console.warn(`[gmailSendEmail_v20260206] Encoding corruption detected`);
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

      if (!rawMimeBase64Url && gmail_thread_id) {
        sendPayload.threadId = gmail_thread_id;
      }

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

      result = await response.json();
    }

    // Resolve or create EmailThread
    let resolvedThreadId = thread_id || email_thread_id;

    // IMMEDIATE LINKING: Link sent emails at send time
    if (result.threadId && (resolvedProjectId || resolvedContractId)) {
      try {
        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
          gmail_thread_id: result.threadId
        });

        if (existingThreads.length > 0) {
          resolvedThreadId = existingThreads[0].id;
          const thread = existingThreads[0];
          const updateData = {};

          if (resolvedContractId && !thread.contract_id) {
            updateData.contract_id = resolvedContractId;
            updateData.linked_to_contract_at = new Date().toISOString();
            updateData.linked_to_contract_by = user.email;
          } else if (resolvedProjectId && !thread.project_id) {
            updateData.project_id = resolvedProjectId;
            updateData.linked_to_project_at = new Date().toISOString();
            updateData.linked_to_project_by = user.email;
          }

          if (Object.keys(updateData).length > 0) {
            await base44.asServiceRole.entities.EmailThread.update(resolvedThreadId, updateData);
            console.log(`[gmailSendEmail_v20260206] Updated thread ${resolvedThreadId} with linking`);
          }
        } else {
          // Create new thread with linking
          const newThread = await base44.asServiceRole.entities.EmailThread.create({
            gmail_thread_id: result.threadId,
            subject: subject || '(no subject)',
            from_address: from || user.email,
            to_addresses: to || [],
            last_message_date: new Date().toISOString(),
            lastMessageDirection: 'sent',
            message_count: 1,
            ...(resolvedContractId && { contract_id: resolvedContractId }),
            ...(resolvedProjectId && !resolvedContractId && { project_id: resolvedProjectId }),
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
          console.log(`[gmailSendEmail_v20260206] Created thread ${resolvedThreadId} with linking`);
        }
      } catch (error) {
        console.error('[gmailSendEmail_v20260206] Error creating thread:', error.message);
      }
    }

    // Create EmailMessage record
    let emailMessageId = null;
    if (resolvedThreadId) {
      try {
        const existingMessages = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: result.id
        });

        let createdMessage;
        if (existingMessages.length > 0) {
          createdMessage = existingMessages[0];
          console.log(`[gmailSendEmail_v20260206] Reused message ${createdMessage.id}`);
        } else {
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
            ...(resolvedProjectId && { project_id: resolvedProjectId }),
            ...(resolvedContractId && { contract_id: resolvedContractId })
          });
          console.log(`[gmailSendEmail_v20260206] Created message ${createdMessage.id}`);
        }
        emailMessageId = createdMessage.id;
      } catch (error) {
        console.error('[gmailSendEmail_v20260206] Error creating message:', error);
      }
    }

    // Persist attachments
    let attachmentPersistResult = null;
    if (resolvedThreadId && attachments && attachments.length > 0) {
      try {
        const thread = await base44.asServiceRole.entities.EmailThread.get(resolvedThreadId);
        if (thread) {
          const targetContractId = resolvedContractId || thread.contract_id;
          const targetProjectId = resolvedProjectId || thread.project_id;
          
          if (targetContractId) {
            attachmentPersistResult = await persistAttachmentsToEntity({
              base44,
              entityType: 'contract',
              entityId: targetContractId,
              threadId: resolvedThreadId,
              messageId: emailMessageId,
              attachments
            });
          } else if (targetProjectId) {
            attachmentPersistResult = await persistAttachmentsToEntity({
              base44,
              entityType: 'project',
              entityId: targetProjectId,
              threadId: resolvedThreadId,
              messageId: emailMessageId,
              attachments
            });
          }
        }
      } catch (error) {
        console.error('[gmailSendEmail_v20260206] Error persisting attachments:', error.message);
      }
    }

    // Update send attempt to sent
    if (attemptId) {
      try {
        await base44.asServiceRole.entities.EmailSendAttempt.update(attemptId, {
          status: 'sent',
          gmail_message_id: result.id,
        });
      } catch (err) {
        console.error('[gmailSendEmail_v20260206] Failed to update attempt:', err.message);
      }
    }

    return Response.json({
      success: true,
      gmailMessageId: result.id,
      gmailThreadId: result.threadId,
      email_thread_id: resolvedThreadId,
      email_message_id: emailMessageId,
      project_id: resolvedProjectId,
      contract_id: resolvedContractId,
      attachment_persist: attachmentPersistResult,
      attempt_id: attemptId
    });

  } catch (error) {
    console.error('[gmailSendEmail_v20260206] Error:', error.message);
    
    return Response.json({ 
      error: error.message || 'Failed to send email'
    }, { status: 500 });
  }
});