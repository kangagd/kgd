// DEPRECATED – not used by email UI anymore, reserved for future AI pipeline.
// Email-to-project/job creation now uses basic fields only (subject, snippet, sender).
// This function remains for backward compatibility or manual AI analysis.

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
  
  const result = {
    first_name: null,
    last_name: null,
    phone: null,
    email: null,
    address: null,
    how_can_we_help: null,
    how_did_you_hear: null,
  };

  const patterns = {
    first_name: /First\s*name:\s*(.+?)(?=\n|Last|$)/i,
    last_name: /Last\s*name:\s*(.+?)(?=\n|Phone|$)/i,
    phone: /Phone:\s*(.+?)(?=\n|Email|$)/i,
    email: /Email:\s*(.+?)(?=\n|Address|$)/i,
    address: /Address:\s*(.+?)(?=\n|How can|$)/i,
    how_can_we_help: /How\s*can\s*we\s*help\??:\s*(.+?)(?=\n|How did|$)/is,
    how_did_you_hear: /How\s*did\s*you\s*hear\s*about\s*us\??:\s*(.+?)(?=\n|$)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      result[key] = match[1].trim();
    }
  }

  return result;
}

function isWixFormEmail(fromAddress, subject) {
  const isWixSender = fromAddress?.toLowerCase() === WIX_SENDER.toLowerCase();
  const isWixSubject = subject?.includes(WIX_SUBJECT_PATTERN);
  return isWixSender && isWixSubject;
}

async function handleWixFormEmail(base44, thread, messages) {
  const formMessage = messages[0];
  const bodyText = formMessage.body_text || 
    (formMessage.body_html ? formMessage.body_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : '');

  const parsedData = parseWixEmailBody(bodyText);

  if (!parsedData || (!parsedData.first_name && !parsedData.email && !parsedData.phone)) {
    return null; // Fall back to AI analysis
  }

  const customerName = [parsedData.first_name, parsedData.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown';

  const customerSource = mapSource(parsedData.how_did_you_hear);

  const suggestedFields = {
    suggested_title: `New Lead - ${customerName}`,
    suggested_description: parsedData.how_can_we_help || '',
    suggested_project_type: null,
    suggested_customer_name: customerName,
    suggested_customer_email: parsedData.email,
    suggested_customer_phone: parsedData.phone,
    suggested_customer_source: customerSource,
    suggested_address: parsedData.address,
    suggested_priority: 'Normal'
  };

  // Determine project type from description
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
    
    if (desc.includes('urgent') || desc.includes('emergency') || desc.includes('asap') || desc.includes('immediately')) {
      suggestedFields.suggested_priority = 'High';
    }
  }

  const summary = `Website enquiry from ${customerName}. ${parsedData.how_can_we_help || 'No details provided.'} Found via ${parsedData.how_did_you_hear || 'unknown source'}.`;

  const keyPoints = [];
  if (customerName !== 'Unknown') keyPoints.push(`Customer: ${customerName}`);
  if (parsedData.phone) keyPoints.push(`Phone: ${parsedData.phone}`);
  if (parsedData.email) keyPoints.push(`Email: ${parsedData.email}`);
  if (parsedData.address) keyPoints.push(`Location: ${parsedData.address}`);
  if (parsedData.how_can_we_help) keyPoints.push(`Request: ${parsedData.how_can_we_help}`);
  if (parsedData.how_did_you_hear) keyPoints.push(`Source: ${parsedData.how_did_you_hear}`);

  // Generate tags based on parsed content
  const tags = ['Website Enquiry'];
  if (suggestedFields.suggested_project_type) {
    tags.push(suggestedFields.suggested_project_type);
  }
  if (parsedData.how_can_we_help) {
    const desc = parsedData.how_can_we_help.toLowerCase();
    if (desc.includes('quote') || desc.includes('price')) tags.push('Quote Request');
    if (desc.includes('urgent') || desc.includes('emergency')) tags.push('Urgent');
    if (desc.includes('garage')) tags.push('Garage Door');
    if (desc.includes('gate')) tags.push('Gate');
    if (desc.includes('motor') || desc.includes('opener')) tags.push('Motor');
    if (desc.includes('remote')) tags.push('Remote');
  }

  // Determine AI priority
  let aiPriority = 'Normal';
  if (suggestedFields.suggested_priority === 'High') {
    aiPriority = 'High';
  }

  return {
    summary,
    key_points: keyPoints,
    suggested_project_fields: suggestedFields,
    tags: [...new Set(tags)],
    ai_priority: aiPriority,
    is_wix_form: true
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_thread_id } = await req.json();

    if (!email_thread_id) {
      return Response.json({ error: 'email_thread_id is required' }, { status: 400 });
    }

    // Fetch the email thread
    const threads = await base44.asServiceRole.entities.EmailThread.filter({ id: email_thread_id });
    if (!threads || threads.length === 0) {
      return Response.json({ error: 'Email thread not found' }, { status: 404 });
    }
    const thread = threads[0];

    // Fetch all messages in the thread
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
      thread_id: email_thread_id 
    }, 'sent_at');

    if (messages.length === 0) {
      return Response.json({ error: 'No messages found in thread' }, { status: 400 });
    }

    // Check if this is a Wix form email - use specialized parsing
    if (isWixFormEmail(thread.from_address, thread.subject)) {
      const wixResult = await handleWixFormEmail(base44, thread, messages);
      
      if (wixResult) {
        const now = new Date().toISOString();

        // Update the EmailThread with parsed data
        await base44.asServiceRole.entities.EmailThread.update(email_thread_id, {
          ai_summary: wixResult.summary,
          ai_key_points: wixResult.key_points,
          ai_suggested_project_fields: wixResult.suggested_project_fields,
          ai_tags: wixResult.tags || [],
          ai_priority: wixResult.ai_priority || 'Normal',
          ai_analyzed_at: now
        });

        // Create/update AIEmailInsight entity
        const existingInsights = await base44.asServiceRole.entities.AIEmailInsight.filter({
          email_thread_id: email_thread_id
        });

        let insight;
        if (existingInsights.length > 0) {
          insight = await base44.asServiceRole.entities.AIEmailInsight.update(existingInsights[0].id, {
            summary: wixResult.summary,
            key_points: wixResult.key_points,
            suggested_project_fields: wixResult.suggested_project_fields,
            tags: wixResult.tags || [],
            ai_priority: wixResult.ai_priority || 'Normal'
          });
        } else {
          insight = await base44.asServiceRole.entities.AIEmailInsight.create({
            email_thread_id: email_thread_id,
            summary: wixResult.summary,
            key_points: wixResult.key_points,
            suggested_project_fields: wixResult.suggested_project_fields,
            tags: wixResult.tags || [],
            ai_priority: wixResult.ai_priority || 'Normal',
            applied_to_project: false
          });
        }

        return Response.json({
          success: true,
          insight_id: insight.id,
          summary: wixResult.summary,
          key_points: wixResult.key_points,
          suggested_project_fields: wixResult.suggested_project_fields,
          tags: wixResult.tags || [],
          ai_priority: wixResult.ai_priority || 'Normal',
          analyzed_at: now,
          source: 'wix_form_parser'
        });
      }
      // If Wix parsing fails, fall through to AI analysis
    }

    // Build the full conversation context
    const conversationText = messages.map(m => {
      const date = m.sent_at ? new Date(m.sent_at).toLocaleString() : 'Unknown date';
      const body = m.body_text || (m.body_html ? m.body_html.replace(/<[^>]*>/g, ' ').substring(0, 2000) : '');
      return `From: ${m.from_name || m.from_address}
To: ${m.to_addresses?.join(', ') || 'Unknown'}
Date: ${date}
Subject: ${m.subject}

${body}`;
    }).join('\n\n---\n\n');

    // Call AI to analyze the thread
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an assistant for a garage door service company. Analyze this email thread and extract insights to help create a project.

EMAIL THREAD:
Subject: ${thread.subject}
From: ${thread.from_address}

MESSAGES:
${conversationText.substring(0, 8000)}

TASKS:
1. Write a concise summary (2-5 sentences) of what this email thread is about.

2. Extract 3-7 key points as bullet items (facts, requests, decisions, or important details).

3. Generate 2-5 relevant tags to categorize this email. Choose from or create tags like:
   - Type: "Quote Request", "Service Call", "Complaint", "Follow-up", "New Enquiry", "Warranty Claim"
   - Product: "Garage Door", "Gate", "Roller Shutter", "Motor", "Remote", "Accessories"
   - Source: "Website Enquiry", "Referral", "Builder", "Real Estate", "Strata"
   - Urgency: "Urgent", "Emergency"
   - Other relevant descriptive tags

4. Determine the AI-suggested priority level:
   - "Urgent": Emergency situations, safety issues, immediate attention needed
   - "High": Time-sensitive requests, frustrated customers, urgent repairs
   - "Normal": Standard enquiries and requests
   - "Low": General information, future planning, non-urgent follow-ups

5. Suggest project fields if this thread could become a project:
   - suggested_title: A clear project title
   - suggested_description: What work needs to be done
   - suggested_project_type: One of "Garage Door Install", "Gate Install", "Roller Shutter Install", "Multiple", "Motor/Accessory", "Repair", "Maintenance"
   - suggested_customer_name: Customer's name if mentioned
   - suggested_customer_email: Customer's email if available
   - suggested_customer_phone: Phone number if mentioned
   - suggested_address: Property address if mentioned
   - suggested_products: Array of products mentioned (e.g., ["Garage Door", "Motor", "Remote"])
   - suggested_priority: "Low", "Normal", or "High" based on urgency

Return JSON with: summary (string), key_points (array of strings), tags (array of strings), ai_priority (string), suggested_project_fields (object with the fields above, use null for unknown fields)`,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          key_points: { 
            type: "array", 
            items: { type: "string" } 
          },
          tags: {
            type: "array",
            items: { type: "string" }
          },
          ai_priority: { type: "string" },
          suggested_project_fields: {
            type: "object",
            properties: {
              suggested_title: { type: "string" },
              suggested_description: { type: "string" },
              suggested_project_type: { type: "string" },
              suggested_customer_name: { type: "string" },
              suggested_customer_email: { type: "string" },
              suggested_customer_phone: { type: "string" },
              suggested_address: { type: "string" },
              suggested_products: { type: "array", items: { type: "string" } },
              suggested_priority: { type: "string" }
            }
          }
        }
      }
    });

    const now = new Date().toISOString();

    // Update the EmailThread with AI insights
    await base44.asServiceRole.entities.EmailThread.update(email_thread_id, {
      ai_summary: aiResponse.summary,
      ai_key_points: aiResponse.key_points || [],
      ai_suggested_project_fields: aiResponse.suggested_project_fields || {},
      ai_tags: aiResponse.tags || [],
      ai_priority: aiResponse.ai_priority || 'Normal',
      ai_analyzed_at: now
    });

    // Create/update AIEmailInsight entity for history
    const existingInsights = await base44.asServiceRole.entities.AIEmailInsight.filter({
      email_thread_id: email_thread_id
    });

    let insight;
    if (existingInsights.length > 0) {
      // Update existing insight
      insight = await base44.asServiceRole.entities.AIEmailInsight.update(existingInsights[0].id, {
        summary: aiResponse.summary,
        key_points: aiResponse.key_points || [],
        suggested_project_fields: aiResponse.suggested_project_fields || {},
        tags: aiResponse.tags || [],
        ai_priority: aiResponse.ai_priority || 'Normal'
      });
    } else {
      // Create new insight
      insight = await base44.asServiceRole.entities.AIEmailInsight.create({
        email_thread_id: email_thread_id,
        summary: aiResponse.summary,
        key_points: aiResponse.key_points || [],
        suggested_project_fields: aiResponse.suggested_project_fields || {},
        tags: aiResponse.tags || [],
        ai_priority: aiResponse.ai_priority || 'Normal',
        applied_to_project: false
      });
    }

    return Response.json({
      success: true,
      insight_id: insight.id,
      summary: aiResponse.summary,
      key_points: aiResponse.key_points,
      suggested_project_fields: aiResponse.suggested_project_fields,
      tags: aiResponse.tags || [],
      ai_priority: aiResponse.ai_priority || 'Normal',
      analyzed_at: now
    });

  } catch (error) {
    console.error('Error generating email insights:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});