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
    throw new Error('Missing Gmail service account credentials');
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

async function gmailFetch(endpoint, accessToken) {
  const response = await fetch(`https://www.googleapis.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

function decodeBase64Url(str) {
  if (!str) return '';
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return new TextDecoder().decode(
      new Uint8Array([...decoded].map(c => c.charCodeAt(0)))
    );
  } catch (err) {
    console.error('[decodeBase64Url] Error:', err);
    return '';
  }
}

function extractBodyText(payload) {
  let bodyHtml = null;
  let bodyText = null;

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
    return { bodyHtml, bodyText };
  }

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

function findAttachments(payload) {
  const attachments = [];

  const traverse = (part) => {
    if (!part) return;

    if (part.filename && part.filename.length > 0) {
      // Skip inline images (cid: references)
      const isInline = part.headers?.some(h => 
        h.name.toLowerCase() === 'content-disposition' && 
        h.value.toLowerCase().includes('inline')
      );
      
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body?.size || 0,
        attachmentId: part.body?.attachmentId,
        isInline: isInline || false
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmailThreadId, linkTarget } = await req.json();

    if (!gmailThreadId) {
      return Response.json({ error: 'gmailThreadId is required' }, { status: 400 });
    }

    console.log('[importGmailThread] Starting import for thread:', gmailThreadId);

    // Check if thread already exists
    const existingThreads = await base44.entities.EmailThread.filter({
      gmail_thread_id: gmailThreadId
    });

    if (existingThreads.length > 0) {
      console.log('[importGmailThread] Thread already exists:', existingThreads[0].id);
      
      // If link target provided and thread not linked, link it now
      if (linkTarget && !existingThreads[0].project_id && !existingThreads[0].job_id) {
        const updateData = {
          project_id: linkTarget.linkedEntityType === 'project' ? linkTarget.linkedEntityId : null,
          job_id: linkTarget.linkedEntityType === 'job' ? linkTarget.linkedEntityId : null,
          project_number: linkTarget.linkedEntityType === 'project' ? linkTarget.linkedEntityNumber : null,
          project_title: linkTarget.linkedEntityType === 'project' ? linkTarget.linkedEntityTitle : null,
          job_number: linkTarget.linkedEntityType === 'job' ? linkTarget.linkedEntityNumber : null,
          linked_to_project_at: new Date().toISOString(),
          linked_to_project_by: user.email
        };

        await base44.entities.EmailThread.update(existingThreads[0].id, updateData);
        console.log('[importGmailThread] Linked existing thread to', linkTarget.linkedEntityType);
      }
      
      return Response.json({
        success: true,
        thread: existingThreads[0],
        message: 'Thread already imported'
      });
    }

    // Fetch thread from Gmail API
    const accessToken = await getAccessToken();
    const threadData = await gmailFetch(`/gmail/v1/users/me/threads/${gmailThreadId}?format=full`, accessToken);

    if (!threadData.messages || threadData.messages.length === 0) {
      throw new Error('No messages found in thread');
    }

    console.log('[importGmailThread] Fetched', threadData.messages.length, 'messages from Gmail');

    // Extract thread-level metadata from first message
    const firstMsg = threadData.messages[0];
    const headerMap = {};
    if (firstMsg.payload?.headers) {
      firstMsg.payload.headers.forEach(h => {
        headerMap[h.name.toLowerCase()] = h.value;
      });
    }

    const threadSubject = headerMap['subject'] || '(no subject)';
    const threadFromAddress = headerMap['from'] || '';

    // Parse participants
    const allTo = new Set();
    const allFrom = new Set();
    threadData.messages.forEach(msg => {
      const msgHeaders = {};
      msg.payload?.headers?.forEach(h => {
        msgHeaders[h.name.toLowerCase()] = h.value;
      });
      if (msgHeaders['from']) allFrom.add(msgHeaders['from']);
      if (msgHeaders['to']) {
        msgHeaders['to'].split(',').forEach(addr => allTo.add(addr.trim()));
      }
    });

    // Create EmailThread entity
    const newThread = await base44.entities.EmailThread.create({
      subject: threadSubject,
      gmail_thread_id: gmailThreadId,
      from_address: threadFromAddress,
      to_addresses: Array.from(allTo),
      last_message_snippet: threadData.messages[threadData.messages.length - 1].snippet || '',
      last_message_date: new Date(parseInt(threadData.messages[threadData.messages.length - 1].internalDate)).toISOString(),
      message_count: threadData.messages.length,
      is_read: false,
      priority: 'Normal',
      project_id: linkTarget?.linkedEntityType === 'project' ? linkTarget.linkedEntityId : null,
      job_id: linkTarget?.linkedEntityType === 'job' ? linkTarget.linkedEntityId : null,
      project_number: linkTarget?.linkedEntityType === 'project' ? linkTarget.linkedEntityNumber : null,
      project_title: linkTarget?.linkedEntityType === 'project' ? linkTarget.linkedEntityTitle : null,
      job_number: linkTarget?.linkedEntityType === 'job' ? linkTarget.linkedEntityNumber : null,
      linked_to_project_at: linkTarget ? new Date().toISOString() : null,
      linked_to_project_by: linkTarget ? user.email : null
    });

    console.log('[importGmailThread] Created EmailThread:', newThread.id);

    // Create EmailMessage entities for each message
    const messagePromises = threadData.messages.map(async (gmailMsg) => {
      const msgHeaders = {};
      if (gmailMsg.payload?.headers) {
        gmailMsg.payload.headers.forEach(h => {
          msgHeaders[h.name.toLowerCase()] = h.value;
        });
      }

      const { bodyHtml, bodyText } = extractBodyText(gmailMsg.payload);
      const attachments = findAttachments(gmailMsg.payload);

      // Determine if outbound (from our domain)
      const fromAddr = msgHeaders['from'] || '';
      const isOutbound = fromAddr.includes('@kangaroogd.com.au');

      return base44.entities.EmailMessage.create({
        thread_id: newThread.id,
        gmail_message_id: gmailMsg.id,
        gmail_thread_id: gmailThreadId,
        from_address: msgHeaders['from'] || '',
        from_name: msgHeaders['from']?.split('<')[0]?.trim() || '',
        to_addresses: msgHeaders['to']?.split(',').map(a => a.trim()) || [],
        cc_addresses: msgHeaders['cc']?.split(',').map(a => a.trim()) || [],
        sent_at: new Date(parseInt(gmailMsg.internalDate)).toISOString(),
        subject: msgHeaders['subject'] || '',
        body_html: bodyHtml,
        body_text: bodyText,
        attachments: attachments,
        is_outbound: isOutbound,
        message_id: msgHeaders['message-id'],
        in_reply_to: msgHeaders['in-reply-to'],
        references: msgHeaders['references']
      });
    });

    await Promise.all(messagePromises);
    console.log('[importGmailThread] Created', messagePromises.length, 'EmailMessage entities');

    return Response.json({
      success: true,
      thread: newThread,
      message: 'Thread imported successfully'
    });
  } catch (error) {
    console.error('[importGmailThread] Error:', error);
    return Response.json({
      error: error.message || 'Failed to import thread',
      details: error.toString()
    }, { status: 500 });
  }
});