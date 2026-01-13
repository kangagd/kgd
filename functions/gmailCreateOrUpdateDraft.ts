import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to build RFC 2822 MIME message
function buildMimeMessage({ from, to, cc, bcc, subject, textBody, htmlBody, inReplyTo, references }) {
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

    const { draftId, rawMimeBase64Url, gmailDraftId, from, to, cc, bcc, subject, textBody, htmlBody, inReplyTo, references } = await req.json();

    // Get Gmail access token
    const GMAIL_CLIENT_ID = Deno.env.get('GMAIL_CLIENT_ID');
    const GMAIL_CLIENT_SECRET = Deno.env.get('GMAIL_CLIENT_SECRET');

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
      return Response.json({ error: 'Gmail credentials not configured' }, { status: 500 });
    }

    // Build MIME message if not provided
    let encodedMessage = rawMimeBase64Url;
    if (!encodedMessage) {
      const mimeMessage = buildMimeMessage({
        from: from || user.email,
        to: to || [],
        cc,
        bcc,
        subject: subject || '',
        textBody,
        htmlBody,
        inReplyTo,
        references
      });
      encodedMessage = base64UrlEncode(mimeMessage);
    }

    // Get OAuth token (assuming user has connected Gmail)
    // This is a simplified version - you may need to implement proper token refresh
    const gmailApiUrl = gmailDraftId
      ? `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${gmailDraftId}`
      : 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';

    const method = gmailDraftId ? 'PUT' : 'POST';

    const result = await retryWithBackoff(async () => {
      const response = await fetch(gmailApiUrl, {
        method,
        headers: {
          'Authorization': `Bearer ${await getGmailAccessToken(user.email)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            raw: encodedMessage
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${error}`);
      }

      return await response.json();
    });

    // Update DraftEmail entity if draftId provided
    if (draftId) {
      await base44.asServiceRole.entities.DraftEmail.update(draftId, {
        gmailDraftId: result.id,
        lastSavedAt: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      gmailDraftId: result.id,
      draftId
    });

  } catch (error) {
    console.error('Error creating/updating Gmail draft:', error);
    return Response.json({ 
      error: error.message || 'Failed to create/update draft' 
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
      scope: 'https://www.googleapis.com/auth/gmail.modify',
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