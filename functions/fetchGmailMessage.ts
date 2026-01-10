import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { gmailFetch } from './shared/gmailClient.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { gmail_message_id } = await req.json();

    if (!gmail_message_id) {
       return Response.json({ error: 'gmail_message_id required' }, { status: 400 });
    }

    const currentUser = await base44.auth.me();
    if (!currentUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const detail = await gmailFetch(
      `/gmail/v1/users/me/messages/${gmail_message_id}`,
      'GET'
    );
    
    // Process body and attachments (simplified logic from gmailSync)
    let bodyHtml = '';
    let bodyText = detail.snippet || '';
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
                gmail_message_id: gmail_message_id,
                content_id: contentId || null,
                is_inline: isInline
              });
            }
          }
          
          if (part.parts) processParts(part.parts);
        } catch (err) {
          console.error('Error processing part:', err);
        }
      }
    };

    try {
      if (detail.payload.body?.data) {
        const decoded = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        if (decoded) bodyText = decoded;
      }
    } catch (err) {}
    
    if (detail.payload.parts) {
      processParts(detail.payload.parts);
    }

    return Response.json({
        body_html: bodyHtml,
        body_text: bodyText,
        attachments
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});