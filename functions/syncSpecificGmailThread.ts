import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

const fixEncodingIssues = (text) => {
  if (text == null) return text;
  let fixed = String(text);

  fixed = fixed
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—");

  const mojibakeReplacements = [
    [/â/g, "'"],
    [/â/g, "'"],
    [/â/g, """],
    [/â/g, """],
    [/â/g, "–"],
    [/â/g, "—"],
    [/â¦/g, "…"],
    [/â€™/g, "'"],
    [/â€˜/g, "'"],
    [/â€œ/g, """],
    [/â€/g, """],
    [/â€¢/g, "•"],
    [/Â /g, " "],
    [/Â/g, " "],
    [/â€‰/g, " "],
    [/â €/g, " "],
    [/Â°/g, "°"],
    [/â‚¬/g, "€"],
    [/â ·/g, "·"],
    [/Ã¢â‚¬â„¢/g, "'"],
  ];

  for (const [pattern, replacement] of mojibakeReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

  const accentReplacements = [
    [/Ã /g, "à"],
    [/Ã¡/g, "á"],
    [/Ã¢/g, "â"],
    [/Ã£/g, "ã"],
    [/Ã¤/g, "ä"],
    [/Ã¨/g, "è"],
    [/Ã©/g, "é"],
    [/Ãª/g, "ê"],
    [/Ã«/g, "ë"],
    [/Ã¬/g, "ì"],
    [/Ã­/g, "í"],
    [/Ã®/g, "î"],
    [/Ã¯/g, "ï"],
    [/Ã²/g, "ò"],
    [/Ã³/g, "ó"],
    [/Ã´/g, "ô"],
    [/Ãµ/g, "õ"],
    [/Ã¶/g, "ö"],
    [/Ã¹/g, "ù"],
    [/Ãº/g, "ú"],
    [/Ã»/g, "û"],
    [/Ã¼/g, "ü"],
  ];

  for (const [pattern, replacement] of accentReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

  return fixed;
};

function parseEmailAddress(addressString) {
  const match = addressString.match(/<(.+)>/);
  return match ? match[1] : addressString;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gmail_thread_id, project_id } = await req.json();

    if (!gmail_thread_id) {
      return Response.json({ error: 'gmail_thread_id is required' }, { status: 400 });
    }

    console.log(`Syncing Gmail thread: ${gmail_thread_id}`);

    // Fetch full thread using service account
    const threadData = await gmailFetch(`/gmail/v1/users/me/threads/${gmail_thread_id}`, 'GET');

    if (!threadData || !threadData.messages) {
      return Response.json({ error: 'Thread not found or has no messages' }, { status: 404 });
    }

    console.log(`Thread has ${threadData.messages.length} messages`);

    // Check if thread already exists by gmail_thread_id
    let existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
      gmail_thread_id: gmail_thread_id
    });

    let threadId;

    if (existingThreads.length > 0) {
      console.log(`Thread ${gmail_thread_id} already synced`);
      threadId = existingThreads[0].id;
    } else {
      // Get first message to extract thread metadata
      const firstMessage = threadData.messages[0];
      const detail = await gmailFetch(`/gmail/v1/users/me/messages/${firstMessage.id}`, 'GET');

      if (!detail?.payload?.headers) {
        return Response.json({ error: 'Invalid message format' }, { status: 400 });
      }

      const headers = detail.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';

      // Create new thread
      const newThread = await base44.asServiceRole.entities.EmailThread.create({
        subject,
        gmail_thread_id: gmail_thread_id,
        from_address: parseEmailAddress(from),
        to_addresses: to.split(',').map(e => parseEmailAddress(e.trim())).filter(Boolean),
        status: 'Open',
        priority: 'Normal',
        message_count: threadData.messages.length
      });

      threadId = newThread.id;

      // Auto-link to project if provided
      if (project_id) {
        await base44.asServiceRole.entities.EmailThread.update(threadId, {
          project_id: project_id,
          linked_to_project_at: new Date().toISOString(),
          linked_to_project_by: 'manual_sync'
        });
        console.log(`Auto-linked thread ${threadId} to project ${project_id}`);
      }
    }

    // Process all messages in thread
    let messagesCreated = 0;
    for (const message of threadData.messages) {
      try {
        // Check if message already exists
        const existing = await base44.asServiceRole.entities.EmailMessage.filter({
          gmail_message_id: message.id
        });

        if (existing.length > 0) {
          console.log(`Message ${message.id} already synced`);
          continue;
        }

        // Fetch full message details
        const fullMessage = await gmailFetch(`/gmail/v1/users/me/messages/${message.id}`, 'GET');

        if (!fullMessage?.payload?.headers) {
          console.warn(`Invalid message format for ${message.id}`);
          continue;
        }

        const headers = fullMessage.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value;
        const messageId = headers.find(h => h.name === 'Message-ID')?.value;

        if (!date) {
          console.warn(`Missing date for message ${message.id}`);
          continue;
        }

        const effectiveMessageId = messageId || message.id;

        // Extract body and attachments
        let bodyHtml = '';
        let bodyText = fullMessage.snippet || '';
        const attachments = [];

        const processParts = (parts) => {
          if (!parts || !Array.isArray(parts)) return;
          for (const part of parts) {
            try {
              if (part.mimeType === 'text/html' && part.body?.data) {
                const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                if (decoded) bodyHtml = decoded;
              } else if (part.mimeType === 'text/plain' && part.body?.data) {
                const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                if (decoded) bodyText = decoded;
              }

              if (part.filename && part.filename.length > 0) {
                const attachmentId = part.body?.attachmentId;
                if (attachmentId) {
                  const contentIdHeader = part.headers?.find(h => h.name.toLowerCase() === 'content-id');
                  const contentDisposition = part.headers?.find(h => h.name.toLowerCase() === 'content-disposition');
                  const contentId = contentIdHeader?.value?.replace(/[<>]/g, '');
                  const isInline = contentDisposition?.value?.toLowerCase().includes('inline') || !!contentId;

                  attachments.push({
                    filename: part.filename,
                    mime_type: part.mimeType,
                    size: parseInt(part.body.size) || 0,
                    attachment_id: attachmentId,
                    gmail_message_id: message.id,
                    content_id: contentId || null,
                    is_inline: isInline
                  });
                }
              }

              if (part.parts) {
                processParts(part.parts);
              }
            } catch (err) {
              console.error('Error processing part:', err);
            }
          }
        };

        if (fullMessage.payload.parts) {
          processParts(fullMessage.payload.parts);
        }

        const impersonateEmail = Deno.env.get('GOOGLE_IMPERSONATE_USER_EMAIL') || 'admin@kangaroogd.com.au';
        const fromAddress = parseEmailAddress(from) || 'unknown@unknown.com';
        const isOutbound = fromAddress.toLowerCase() === impersonateEmail.toLowerCase() ||
          fullMessage.labelIds?.includes('SENT');

        const toAddresses = to ? to.split(',').map(e => parseEmailAddress(e.trim())).filter(e => e) : [];

        const messageData = {
          thread_id: threadId,
          gmail_message_id: message.id,
          from_address: fromAddress,
          to_addresses: toAddresses.length > 0 ? toAddresses : [fromAddress],
          sent_at: new Date(date).toISOString(),
          subject: fixEncodingIssues(subject || '(No Subject)'),
          body_html: fixEncodingIssues(bodyHtml),
          body_text: fixEncodingIssues(bodyText),
          message_id: effectiveMessageId,
          is_outbound: isOutbound,
          attachments: attachments.length > 0 ? attachments : undefined
        };

        await base44.asServiceRole.entities.EmailMessage.create(messageData);
        messagesCreated++;
        console.log(`Created message ${message.id}`);
      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError.message);
      }
    }

    // Update thread message count if new messages were created
    if (messagesCreated > 0) {
      const updatedThread = await base44.asServiceRole.entities.EmailThread.get(threadId);
      await base44.asServiceRole.entities.EmailThread.update(threadId, {
        message_count: (updatedThread.message_count || 0) + messagesCreated
      });
    }

    console.log(`Sync complete: ${messagesCreated} new messages created`);

    return Response.json({
      success: true,
      thread_id: threadId,
      messages_created: messagesCreated,
      gmail_thread_id: gmail_thread_id
    });
  } catch (error) {
    console.error('Sync Gmail thread error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});