/**
 * Preview Project Creation from Email
 * Returns suggested category, address, customer name, description bullets, attachment count
 * Used by UI to show preview before user confirms
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  extractCustomerEmail,
  extractCustomerName,
  extractAddressFromBody,
  formatShortAddress,
  classifyCategory,
  cleanEmailBody,
  generateBulletDescription,
} from './shared/emailProjectCreateHelpers.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_thread_id, email_message_id } = await req.json();

    if (!email_thread_id || !email_message_id) {
      return Response.json(
        { error: 'Missing email_thread_id or email_message_id' },
        { status: 400 }
      );
    }

    // Fetch message
    let emailMessage;
    try {
      emailMessage = await base44.entities.EmailMessage.get(email_message_id);
    } catch {
      return Response.json({ error: 'Email message not found' }, { status: 404 });
    }

    // Extract customer
    const customerEmail = extractCustomerEmail(emailMessage);
    const displayName = emailMessage.from_name || '';
    const customerName = extractCustomerName(displayName, customerEmail);

    // Clean body + extract info
    const cleanedBody = cleanEmailBody(emailMessage.body_html, emailMessage.body_text);
    const extractedAddress = extractAddressFromBody(cleanedBody);
    const shortAddress = formatShortAddress(extractedAddress);

    // Classify category
    const classification = classifyCategory(emailMessage.subject, cleanedBody);

    // Generate bullets
    const bullets = generateBulletDescription(cleanedBody);

    // Count attachments
    const attachmentCount = emailMessage.attachments?.filter(att => !att.is_inline).length || 0;

    return Response.json({
      customer_email: customerEmail,
      customer_name: customerName,
      suggested_category: classification.category,
      category_confidence: classification.confidence,
      short_address: shortAddress,
      description_bullets: bullets,
      attachment_count: attachmentCount,
      original_subject: emailMessage.subject,
    });
  } catch (error) {
    console.error('[previewProjectFromEmail] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to generate preview' },
      { status: 500 }
    );
  }
});