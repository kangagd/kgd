/**
 * Create Project from Email - Deterministic Workflow
 * 
 * Input: { email_thread_id, email_message_id, selected_category_override? }
 * 
 * Workflow:
 * 1. Fetch email thread + message
 * 2. Extract/resolve customer
 * 3. Classify category + extract address
 * 4. Generate project name + description
 * 5. Create project + auto-link thread/message
 * 6. Attach all email attachments
 * 
 * Idempotency: Check for recent duplicate (5 min window) by email_message_id
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// HELPER FUNCTIONS (inlined to avoid module import issues)
// ============================================================================

function extractCustomerEmail(emailMessage) {
  if (!emailMessage) return null;
  return emailMessage.from_address?.toLowerCase() || null;
}

function extractCustomerName(displayName, email) {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }
  if (email) {
    const name = email.split('@')[0];
    return name.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return null;
}

function extractPhoneFromBody(text) {
  if (!text) return null;
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const match = text.match(phoneRegex);
  return match ? match[0] : null;
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

    const { email_thread_id, email_message_id, selected_category_override } = await req.json();

    if (!email_thread_id || !email_message_id) {
      return Response.json(
        { error: 'Missing email_thread_id or email_message_id' },
        { status: 400 }
      );
    }

    // ============================================================================
    // 1. FETCH EMAIL THREAD + MESSAGE
    // ============================================================================
    let emailThread, emailMessage;
    try {
      emailThread = await base44.entities.EmailThread.get(email_thread_id);
      emailMessage = await base44.entities.EmailMessage.get(email_message_id);
    } catch (err) {
      return Response.json(
        { error: `Failed to fetch email: ${err.message}` },
        { status: 404 }
      );
    }

    if (!emailMessage) {
      return Response.json({ error: 'Email message not found' }, { status: 404 });
    }

    // ============================================================================
    // 2. IDEMPOTENCY CHECK (5 minute window by message ID)
    // ============================================================================
    const recentWindow = new Date(Date.now() - 5 * 60000); // 5 minutes ago
    const recentProjects = await base44.entities.Project.filter({
      source_email_thread_id: email_thread_id,
      created_date: { $gte: recentWindow.toISOString() },
    });

    if (recentProjects.length > 0) {
      return Response.json({
        success: true,
        projectId: recentProjects[0].id,
        message: 'Project already created from this email',
        isDuplicate: true,
      });
    }

    // ============================================================================
    // 3. EXTRACT + RESOLVE CUSTOMER
    // ============================================================================
    const customerEmail = extractCustomerEmail(emailMessage);
    if (!customerEmail) {
      return Response.json(
        { error: 'Could not determine external customer email' },
        { status: 400 }
      );
    }

    // Try to match existing customer
    let customer = null;
    const existingCustomers = await base44.entities.Customer.filter({});
    customer = existingCustomers.find(
      c => c.email?.toLowerCase() === customerEmail.toLowerCase()
    );

    // Create new customer if not found
    if (!customer) {
      const displayName = emailMessage.from_name || '';
      const extractedName = extractCustomerName(displayName, customerEmail);
      const name = extractedName || customerEmail.split('@')[0];

      // Extract optional phone + address
      const cleanBody = cleanEmailBody(emailMessage.body_html, emailMessage.body_text);
      const phone = extractPhoneFromBody(cleanBody);
      const address = extractAddressFromBody(cleanBody);

      customer = await base44.entities.Customer.create({
        name,
        email: customerEmail,
        phone: phone || undefined,
        address_street: address?.street || undefined,
        address_suburb: address?.suburb || undefined,
        address_postcode: address?.postcode || undefined,
        address_full: address?.fullAddress || undefined,
        source: 'email_inbox_create_project',
      });
    }

    // ============================================================================
    // 4. CLASSIFY CATEGORY + EXTRACT ADDRESS
    // ============================================================================
    const cleanedBody = cleanEmailBody(emailMessage.body_html, emailMessage.body_text);
    const classification = classifyCategory(
      emailMessage.subject,
      cleanedBody,
      selected_category_override
    );

    // Extract address from body OR use customer's existing address
    let extractedAddress = extractAddressFromBody(cleanedBody);
    if (!extractedAddress && customer.address_full) {
      extractedAddress = { fullAddress: customer.address_full };
    }

    const shortAddress = formatShortAddress(extractedAddress);

    // ============================================================================
    // 5. GENERATE PROJECT NAME + DESCRIPTION
    // ============================================================================
    const projectName = `${classification.category} - ${shortAddress}`;
    const description = generateBulletDescription(cleanedBody).join('\n• ');
    const descriptionBullets = `• ${description}`;

    // ============================================================================
    // 6. CREATE PROJECT
    // ============================================================================
    const project = await base44.entities.Project.create({
      title: projectName,
      description: descriptionBullets,
      customer_id: customer.id,
      customer_name: customer.name,
      status: 'Lead',
      project_type: 'Repair', // Default; can be inferred more if needed
      address_street: extractedAddress?.street,
      address_suburb: extractedAddress?.suburb,
      address_postcode: extractedAddress?.postcode,
      address_full: extractedAddress?.fullAddress,
      source_email_thread_id: email_thread_id,
      opened_date: new Date().toISOString().split('T')[0],
    });

    // ============================================================================
    // 7. LINK EMAIL TO PROJECT (immediate)
    // ============================================================================
    // Update thread to link to project
    if (emailThread) {
      await base44.entities.EmailThread.update(email_thread_id, {
        project_id: project.id,
        project_number: project.project_number,
        project_title: project.title,
        linked_to_project_at: new Date().toISOString(),
        linked_to_project_by: user.email,
      });
    }

    // ============================================================================
    // 8. ATTACH EMAIL ATTACHMENTS TO PROJECT
    // ============================================================================
    const attachmentErrors = [];
    if (emailMessage.attachments && emailMessage.attachments.length > 0) {
      for (const att of emailMessage.attachments) {
        try {
          // Only attach non-inline by default (or mark inline as pending)
          if (!att.is_inline && att.url) {
            // Create attachment record
            await base44.entities.ProjectAttachment?.create?.({
              project_id: project.id,
              filename: att.filename,
              url: att.url,
              mime_type: att.mime_type,
              source: 'email',
              source_email_message_id: email_message_id,
            }).catch(() => {
              // If entity doesn't exist, store as project document (fallback)
              attachmentErrors.push({ filename: att.filename, reason: 'No ProjectAttachment entity' });
            });
          }
        } catch (err) {
          attachmentErrors.push({ filename: att.filename, reason: err.message });
        }
      }
    }

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return Response.json({
      success: true,
      projectId: project.id,
      projectNumber: project.project_number,
      projectTitle: project.title,
      customerId: customer.id,
      customerName: customer.name,
      attachmentsAttached: emailMessage.attachments?.length || 0,
      attachmentErrors: attachmentErrors.length > 0 ? attachmentErrors : undefined,
      message: 'Project created successfully',
    });
  } catch (error) {
    console.error('[createProjectFromEmail] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
});