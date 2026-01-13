import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to build RFC 2822 MIME message
function buildMimeMessage({ from, to, cc, bcc, subject, textBody, htmlBody, inReplyTo, references, threadId }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const lines = [];

  // Headers
  lines.push(`From: ${from}`);
  lines.push(`To: ${to.join(', ')}`);
  if (cc && cc.length > 0) lines.push(`Cc: ${cc.join(', ')}`);
  if (bcc && bcc.length > 0) lines.push(`Bcc: ${bcc.join(', ')}`);
  lines.push(`Subject: ${subject}`);
  
  // Thread headers for replies
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  
  lines.push('MIME-Version: 1.0');
  
  if (htmlBody) {
    // Multipart for HTML + text
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    
    // Plain text part
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(textBody || htmlBody.replace(/<[^>]*>/g, ''));
    lines.push('');
    
    // HTML part
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
      references 
    } = await req.json();

    // Get Service Account credentials
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL');

    if (!serviceAccountJson || !impersonateEmail) {
      return Response.json({ error: 'Gmail credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_IMPERSONATE_USER_EMAIL' }, { status: 500 });
    }

    // Get access token using service account
    const accessToken = await getGmailAccessToken();

    let result;

    if (gmailDraftId) {
      // Send existing draft
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
          const error = await response.text();
          throw new Error(`Gmail API error (${response.status}): ${error}`);
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
          textBody: textBody || body_text,
          htmlBody: htmlBody || body_html,
          inReplyTo,
          references,
          threadId: thread_id || gmail_thread_id
        });
        encodedMessage = base64UrlEncode(mimeMessage);
      }

      const sendPayload = {
        raw: encodedMessage
      };

      // Add threadId if this is a reply
      if (thread_id || gmail_thread_id) {
        sendPayload.threadId = thread_id || gmail_thread_id;
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

    // Create EmailMessage record for sent email
    if (thread_id) {
      try {
        await base44.asServiceRole.entities.EmailMessage.create({
          thread_id,
          gmail_message_id: result.id,
          gmail_thread_id: result.threadId || gmail_thread_id,
          from_address: from || user.email,
          to_addresses: to || [],
          cc_addresses: cc || [],
          bcc_addresses: bcc || [],
          subject: subject || '',
          body_html: htmlBody || body_html,
          body_text: textBody || body_text || (htmlBody || body_html || '').replace(/<[^>]*>/g, ''),
          is_outbound: true,
          sent_at: new Date().toISOString(),
          performed_by_user_id: user.id,
          performed_by_user_email: user.email,
          performed_at: new Date().toISOString()
        });

        // Update thread last_message_date
        const thread = await base44.asServiceRole.entities.EmailThread.get(thread_id);
        if (thread) {
          await base44.asServiceRole.entities.EmailThread.update(thread_id, {
            last_message_date: new Date().toISOString(),
            lastMessageDirection: 'sent'
          });
        }
      } catch (error) {
        console.error('Error creating EmailMessage record:', error);
      }
    }

    return Response.json({
      success: true,
      gmailMessageId: result.id,
      gmailThreadId: result.threadId,
      labelIds: result.labelIds
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return Response.json({ 
      error: error.message || 'Failed to send email' 
    }, { status: 500 });
  }
});

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
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
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