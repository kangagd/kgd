/**
 * Preview Project Creation from Email
 * Returns suggested category, address, customer name, description bullets, attachment count
 * Used by UI to show preview before user confirms
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// HELPER FUNCTIONS (inlined to avoid module import issues)
// ============================================================================

function extractCustomerEmail(emailMessage) {
  if (!emailMessage) return null;
  
  // Handle "Name <email@example.com>" format
  const fromAddress = emailMessage.from_address || '';
  const emailMatch = fromAddress.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }
  
  return fromAddress.toLowerCase() || null;
}

function extractCustomerName(displayName, email) {
  // Handle "Name <email@example.com>" format in displayName
  if (displayName) {
    const nameMatch = displayName.match(/^([^<]+)</);
    if (nameMatch) {
      return nameMatch[1].trim();
    }
    if (displayName.trim().length > 0 && !displayName.includes('@')) {
      return displayName.trim();
    }
  }
  
  // Fallback: extract from email
  if (email) {
    const cleanEmail = email.replace(/<|>/g, '').split('@')[0];
    return cleanEmail.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  
  return null;
}

function extractAddressFromBody(text) {
  if (!text) return null;
  const addressRegex = /(\d+\s+[a-zA-Z\s]+)[,]?\s+([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{4})/;
  const match = text.match(addressRegex);
  if (match) {
    return {
      street: match[1].trim(),
      suburb: match[2].trim(),
      state: match[3],
      postcode: match[4],
      fullAddress: `${match[1].trim()}, ${match[2].trim()} ${match[3]} ${match[4]}`,
    };
  }
  return null;
}

function formatShortAddress(addressObj) {
  if (!addressObj) return 'Address Unknown';
  if (addressObj.suburb && addressObj.postcode) {
    return `${addressObj.suburb} ${addressObj.postcode}`;
  }
  if (addressObj.suburb) return addressObj.suburb;
  if (addressObj.fullAddress) return addressObj.fullAddress;
  return 'Address Unknown';
}

function classifyCategory(subject, body, overrideCategory = null) {
  if (overrideCategory) {
    return { category: overrideCategory, confidence: 'user-selected' };
  }
  const combined = `${subject} ${body}`.toLowerCase();
  const categories = {
    'Sectional Door Repair': ['garage door repair', 'broken door', 'door stuck', 'door broken'],
    'Sectional Door Install': ['garage door install', 'new door', 'install garage door'],
    'Roller Shutter Repair': ['roller shutter repair', 'shutter broken', 'shutter stuck'],
    'Roller Shutter Install': ['roller shutter install', 'new shutter', 'install shutter'],
    'Maintenance Service': ['maintenance', 'service call', 'regular service'],
    'General Enquiry': ['enquiry', 'inquiry', 'quote', 'more info'],
  };
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      return { category, confidence: 'high' };
    }
  }
  return { category: 'General Enquiry', confidence: 'low' };
}

function cleanEmailBody(htmlBody, textBody) {
  let body = htmlBody || textBody || '';
  body = body.replace(/<[^>]*>/g, ' ');
  body = body.split(/^--\s*$/m)[0];
  body = body.split(/^Sent from/m)[0];
  body = body.replace(/\s+/g, ' ').trim();
  return body;
}

function generateBulletDescription(text) {
  if (!text || text.length === 0) return [];
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 200)
    .slice(0, 5);
  return sentences.length > 0 ? sentences : ['Email received from customer'];
}

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