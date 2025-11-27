import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all email messages
    const messages = await base44.asServiceRole.entities.EmailMessage.list('-created_date', 100);
    
    console.log('=== Attachment Debug Report ===');
    console.log(`Total messages checked: ${messages.length}`);
    
    const messagesWithAttachments = messages.filter(m => m.attachments && m.attachments.length > 0);
    const messagesWithoutAttachments = messages.filter(m => !m.attachments || m.attachments.length === 0);
    
    console.log(`Messages WITH attachments: ${messagesWithAttachments.length}`);
    console.log(`Messages WITHOUT attachments: ${messagesWithoutAttachments.length}`);
    
    const attachmentDetails = [];
    
    for (const msg of messagesWithAttachments) {
      console.log(`\n--- Message: ${msg.subject} ---`);
      console.log(`From: ${msg.from_address}`);
      console.log(`Date: ${msg.sent_at}`);
      console.log(`Attachments: ${msg.attachments.length}`);
      
      for (const att of msg.attachments) {
        console.log(`  - ${att.filename} (${att.mime_type}, ${att.size} bytes)`);
        console.log(`    attachment_id: ${att.attachment_id || 'MISSING'}`);
        console.log(`    gmail_message_id: ${att.gmail_message_id || 'MISSING'}`);
        console.log(`    url: ${att.url || 'MISSING'}`);
        
        attachmentDetails.push({
          message_subject: msg.subject,
          message_id: msg.id,
          filename: att.filename,
          mime_type: att.mime_type,
          size: att.size,
          has_attachment_id: !!att.attachment_id,
          has_gmail_message_id: !!att.gmail_message_id,
          has_url: !!att.url,
          attachment_id: att.attachment_id,
          gmail_message_id: att.gmail_message_id
        });
      }
    }
    
    // Sample a few messages without attachments to see their structure
    console.log('\n=== Sample messages without attachments ===');
    for (const msg of messagesWithoutAttachments.slice(0, 5)) {
      console.log(`Subject: ${msg.subject}`);
      console.log(`From: ${msg.from_address}`);
      console.log(`attachments field: ${JSON.stringify(msg.attachments)}`);
    }

    return Response.json({
      total_messages: messages.length,
      with_attachments: messagesWithAttachments.length,
      without_attachments: messagesWithoutAttachments.length,
      attachment_details: attachmentDetails,
      sample_messages: messagesWithoutAttachments.slice(0, 5).map(m => ({
        subject: m.subject,
        from: m.from_address,
        attachments_field: m.attachments
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});