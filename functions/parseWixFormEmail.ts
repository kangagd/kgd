import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const WIX_SENDER = 'no-reply@crm.wix.com';
const WIX_SUBJECT_PATTERN = 'You have received a new notification from KangarooGD';

// Map "How did you hear about us?" to Customer source enum values
const SOURCE_MAPPING = {
  'google search/map': 'Google',
  'google': 'Google',
  'google search': 'Google',
  'google maps': 'Google',
  'word of mouth': 'Word of mouth',
  'referral': 'Word of mouth',
  'friend': 'Word of mouth',
  'facebook': 'Socials',
  'instagram': 'Socials',
  'social media': 'Socials',
  'socials': 'Socials',
  'car': 'Car/Trailer',
  'trailer': 'Car/Trailer',
  'saw your van': 'Car/Trailer',
  'builder': 'Builder',
  'real estate': 'Real Estate',
  'strata': 'Strata',
  'gliderol': 'Gliderol',
  '4d': '4D',
};

function mapSource(rawSource) {
  if (!rawSource) return 'Other';
  const normalized = rawSource.toLowerCase().trim();
  
  for (const [pattern, source] of Object.entries(SOURCE_MAPPING)) {
    if (normalized.includes(pattern)) {
      return source;
    }
  }
  return 'Other';
}

function parseWixEmailBody(bodyText) {
  if (!bodyText) return null;
  
  console.log('[parseWixEmailBody] Raw body text length:', bodyText.length);
  console.log('[parseWixEmailBody] First 1000 chars:', bodyText.substring(0, 1000));
  
  const result = {
    first_name: null,
    last_name: null,
    phone: null,
    email: null,
    address: null,
    how_can_we_help: null,
    how_did_you_hear: null,
  };

  // Extract each field line by line - more reliable
  const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  console.log('[parseWixEmailBody] Lines:', lines);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // First name
    if (/^First\s*name\s*:/i.test(line)) {
      result.first_name = line.replace(/^First\s*name\s*:\s*/i, '').trim();
    }
    // Last name
    else if (/^Last\s*name\s*:/i.test(line)) {
      result.last_name = line.replace(/^Last\s*name\s*:\s*/i, '').trim();
    }
    // Phone
    else if (/^Phone\s*:/i.test(line)) {
      result.phone = line.replace(/^Phone\s*:\s*/i, '').trim();
    }
    // Email
    else if (/^Email\s*:/i.test(line)) {
      result.email = line.replace(/^Email\s*:\s*/i, '').trim();
    }
    // Address
    else if (/^Address\s*:/i.test(line)) {
      result.address = line.replace(/^Address\s*:\s*/i, '').trim();
    }
    // How can we help - may span multiple lines
    else if (/^How\s*can\s*we\s*help/i.test(line)) {
      const helpText = line.replace(/^How\s*can\s*we\s*help\??:\s*/i, '').trim();
      // Collect following lines until next field or "How did you hear"
      let fullHelp = helpText;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^How\s*did\s*you\s*hear/i.test(lines[j])) break;
        if (/^(First|Last|Phone|Email|Address)\s*:/i.test(lines[j])) break;
        fullHelp += ' ' + lines[j];
      }
      result.how_can_we_help = fullHelp.trim();
    }
    // How did you hear
    else if (/^How\s*did\s*you\s*hear/i.test(line)) {
      result.how_did_you_hear = line.replace(/^How\s*did\s*you\s*hear\s*about\s*us\??:\s*/i, '').trim();
    }
  }

  console.log('[parseWixEmailBody] Final parsed result:', result);
  return result;
}

function isWixFormEmail(fromAddress, subject) {
  const isWixSender = fromAddress?.toLowerCase() === WIX_SENDER.toLowerCase();
  const isWixSubject = subject?.includes(WIX_SUBJECT_PATTERN);
  return isWixSender && isWixSubject;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_thread_id, message_id } = await req.json();

    if (!email_thread_id) {
      return Response.json({ error: 'email_thread_id is required' }, { status: 400 });
    }

    // Fetch the email thread
    const threads = await base44.asServiceRole.entities.EmailThread.filter({ id: email_thread_id });
    if (!threads || threads.length === 0) {
      return Response.json({ error: 'Email thread not found' }, { status: 404 });
    }
    const thread = threads[0];

    // Check if this is a Wix form email
    if (!isWixFormEmail(thread.from_address, thread.subject)) {
      return Response.json({ 
        success: false, 
        is_wix_email: false,
        message: 'Not a Wix form email' 
      });
    }

    // Fetch messages in the thread
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
      thread_id: email_thread_id 
    }, 'sent_at');

    if (messages.length === 0) {
      return Response.json({ error: 'No messages found in thread' }, { status: 400 });
    }

    // Get the first message (the form submission)
    const formMessage = messages[0];
    const bodyText = formMessage.body_text || 
      (formMessage.body_html ? formMessage.body_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : '');

    // Parse the Wix form data
    const parsedData = parseWixEmailBody(bodyText);

    if (!parsedData || (!parsedData.first_name && !parsedData.email && !parsedData.phone)) {
      return Response.json({ 
        success: false, 
        is_wix_email: true,
        message: 'Could not parse form data from email body' 
      });
    }

    // Build customer name
    const customerName = [parsedData.first_name, parsedData.last_name]
      .filter(Boolean)
      .join(' ') || 'Unknown';

    // Map source to enum value
    const customerSource = mapSource(parsedData.how_did_you_hear);

    // Build suggested project fields
    const suggestedFields = {
      suggested_title: `New Lead - ${customerName}`,
      suggested_description: parsedData.how_can_we_help || '',
      suggested_project_type: null, // Will be determined by description analysis
      suggested_customer_name: customerName,
      suggested_customer_email: parsedData.email,
      suggested_customer_phone: parsedData.phone,
      suggested_address: parsedData.address,
      suggested_source: customerSource,
      suggested_source_details: parsedData.how_did_you_hear,
      suggested_priority: 'Normal'
    };

    // Try to determine project type from description
    if (parsedData.how_can_we_help) {
      const desc = parsedData.how_can_we_help.toLowerCase();
      if (desc.includes('install') && desc.includes('garage')) {
        suggestedFields.suggested_project_type = 'Garage Door Install';
      } else if (desc.includes('install') && desc.includes('gate')) {
        suggestedFields.suggested_project_type = 'Gate Install';
      } else if (desc.includes('install') && (desc.includes('roller') || desc.includes('shutter'))) {
        suggestedFields.suggested_project_type = 'Roller Shutter Install';
      } else if (desc.includes('repair') || desc.includes('broken') || desc.includes('fix')) {
        suggestedFields.suggested_project_type = 'Repair';
      } else if (desc.includes('service') || desc.includes('maintenance')) {
        suggestedFields.suggested_project_type = 'Maintenance';
      } else if (desc.includes('motor') || desc.includes('remote') || desc.includes('opener')) {
        suggestedFields.suggested_project_type = 'Motor/Accessory';
      } else if (desc.includes('replacement') || desc.includes('replace') || desc.includes('new')) {
        suggestedFields.suggested_project_type = 'Garage Door Install';
      }
      
      // Check for urgency
      if (desc.includes('urgent') || desc.includes('emergency') || desc.includes('asap') || desc.includes('immediately')) {
        suggestedFields.suggested_priority = 'High';
      }
    }

    // Build summary
    const summary = `Website enquiry from ${customerName}. ${parsedData.how_can_we_help || 'No details provided.'} Found via ${parsedData.how_did_you_hear || 'unknown source'}.`;

    // Build key points
    const keyPoints = [];
    if (customerName !== 'Unknown') keyPoints.push(`Customer: ${customerName}`);
    if (parsedData.phone) keyPoints.push(`Phone: ${parsedData.phone}`);
    if (parsedData.email) keyPoints.push(`Email: ${parsedData.email}`);
    if (parsedData.address) keyPoints.push(`Location: ${parsedData.address}`);
    if (parsedData.how_can_we_help) keyPoints.push(`Request: ${parsedData.how_can_we_help}`);
    if (parsedData.how_did_you_hear) keyPoints.push(`Source: ${parsedData.how_did_you_hear}`);

    const now = new Date().toISOString();

    // Update the EmailThread with parsed data
    await base44.asServiceRole.entities.EmailThread.update(email_thread_id, {
      ai_summary: summary,
      ai_key_points: keyPoints,
      ai_suggested_project_fields: suggestedFields,
      ai_analyzed_at: now
    });

    // Create/update AIEmailInsight entity
    const existingInsights = await base44.asServiceRole.entities.AIEmailInsight.filter({
      email_thread_id: email_thread_id
    });

    let insight;
    if (existingInsights.length > 0) {
      insight = await base44.asServiceRole.entities.AIEmailInsight.update(existingInsights[0].id, {
        summary: summary,
        key_points: keyPoints,
        suggested_project_fields: suggestedFields
      });
    } else {
      insight = await base44.asServiceRole.entities.AIEmailInsight.create({
        email_thread_id: email_thread_id,
        summary: summary,
        key_points: keyPoints,
        suggested_project_fields: suggestedFields,
        applied_to_project: false
      });
    }

    return Response.json({
      success: true,
      is_wix_email: true,
      insight_id: insight.id,
      parsed_data: parsedData,
      summary: summary,
      key_points: keyPoints,
      suggested_project_fields: suggestedFields,
      analyzed_at: now
    });

  } catch (error) {
    console.error('Error parsing Wix form email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});