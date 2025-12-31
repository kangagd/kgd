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

async function findExistingProjectMatch(base44, parsedEmail) {
  try {
    const customers = await base44.asServiceRole.entities.Customer.list();
    const projects = await base44.asServiceRole.entities.Project.filter({ deleted_at: null });

    let matchedProject = null;
    let confidence = 0;

    // Try to match by customer email
    if (parsedEmail.customer_email) {
      const matchingCustomer = customers.find(c => 
        c.email?.toLowerCase() === parsedEmail.customer_email.toLowerCase()
      );

      if (matchingCustomer) {
        // Find recent open projects for this customer
        const customerProjects = projects.filter(p => 
          p.customer_id === matchingCustomer.id && 
          !['Completed', 'Lost', 'Warranty'].includes(p.status)
        );

        if (customerProjects.length > 0) {
          // Return most recent
          matchedProject = customerProjects.sort((a, b) => 
            new Date(b.created_date) - new Date(a.created_date)
          )[0];
          confidence = 0.8;
        }
      }
    }

    // Try to match by address if no customer match
    if (!matchedProject && parsedEmail.address) {
      const addressLower = parsedEmail.address.toLowerCase();
      const projectsByAddress = projects.filter(p => {
        const projectAddress = (p.address_full || p.address || '').toLowerCase();
        return projectAddress.includes(addressLower) || addressLower.includes(projectAddress);
      });

      if (projectsByAddress.length > 0) {
        matchedProject = projectsByAddress[0];
        confidence = 0.6;
      }
    }

    return matchedProject ? { project_id: matchedProject.id, project_confidence: confidence } : null;
  } catch (error) {
    console.error('Error finding project match:', error);
    return null;
  }
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
    const thread = await base44.asServiceRole.entities.EmailThread.get(email_thread_id);
    if (!thread) {
      return Response.json({ error: 'Email thread not found' }, { status: 404 });
    }

    // Fetch all messages in the thread
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
      thread_id: email_thread_id 
    }, 'sent_at');

    if (messages.length === 0) {
      return Response.json({ error: 'No messages found in thread' }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    const firstMessage = messages[0];
    const bodyText = latestMessage.body_text || 
      (latestMessage.body_html ? latestMessage.body_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : '');

    let parsedEmail = {};
    let isWix = false;

    // STEP 1: Detect and parse Wix enquiry
    if (isWixFormEmail(thread.from_address, thread.subject)) {
      isWix = true;
      const wixBody = firstMessage.body_text || 
        (firstMessage.body_html ? firstMessage.body_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : '');
      
      const wixData = parseWixEmailBody(wixBody);
      
      if (wixData && (wixData.first_name || wixData.email || wixData.phone)) {
        const customerName = [wixData.first_name, wixData.last_name].filter(Boolean).join(' ') || 'Unknown';
        
        parsedEmail = {
          customer_name: customerName,
          customer_email: wixData.email,
          customer_phone: wixData.phone,
          address: wixData.address,
          description: wixData.how_can_we_help,
          title: `New Lead - ${customerName}`,
          source: mapSource(wixData.how_did_you_hear)
        };
      }
    } 
    
    // STEP 2: Non-Wix email - use AI to parse
    if (!isWix || !parsedEmail.customer_name) {
      const conversationText = messages.map(m => {
        const body = m.body_text || (m.body_html ? m.body_html.replace(/<[^>]*>/g, ' ').substring(0, 1500) : '');
        return `From: ${m.from_name || m.from_address}
To: ${m.to_addresses?.join(', ') || 'Unknown'}
Subject: ${m.subject}

${body}`;
      }).join('\n\n---\n\n');

      const parseResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Extract structured data from this email thread for a garage door service company.

EMAIL THREAD:
${conversationText.substring(0, 6000)}

Extract and return ONLY the following fields (use null for unknown):
- customer_name: Full name of the customer if mentioned
- customer_email: Email address if mentioned (not the sender unless it's clearly the customer)
- customer_phone: Phone number if mentioned
- address: Property address if mentioned
- description: What the customer needs or is asking about
- title: A clear, concise title for this enquiry (e.g., "Garage Door Repair - Unit 5")

Return JSON only.`,
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            customer_email: { type: "string" },
            customer_phone: { type: "string" },
            address: { type: "string" },
            description: { type: "string" },
            title: { type: "string" }
          }
        }
      });

      parsedEmail = parseResponse;
    }

    // STEP 3: Generate AI overview and key points
    let conversationForAI;
    
    if (isWix && parsedEmail.customer_name) {
      // For Wix emails, use the parsed form data instead of raw email body
      conversationForAI = `Website Enquiry Form Submission:
Customer: ${parsedEmail.customer_name}
Email: ${parsedEmail.customer_email || 'Not provided'}
Phone: ${parsedEmail.customer_phone || 'Not provided'}
Address: ${parsedEmail.address || 'Not provided'}
Request: ${parsedEmail.description || 'No details provided'}
Source: ${parsedEmail.source || 'Website form'}`;
    } else {
      // For regular emails, use conversation
      conversationForAI = messages.map(m => {
        const body = m.body_text || (m.body_html ? m.body_html.replace(/<[^>]*>/g, ' ').substring(0, 1500) : '');
        return `${m.from_name || m.from_address}: ${body}`;
      }).join('\n\n');
    }

    const overviewResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this ${isWix ? 'website form submission' : 'email thread'} for a garage door service company and provide:

1. A SHORT overview (1-3 sentences max) summarizing what the customer needs or is asking about.
2. Key points (3-7 bullet items) - facts, requests, or important details about the customer's needs.

${isWix ? 'FORM SUBMISSION' : 'EMAIL'}:
Subject: ${thread.subject}
From: ${thread.from_address}

${isWix ? 'CUSTOMER ENQUIRY' : 'CONVERSATION'}:
${conversationForAI.substring(0, 5000)}

Return JSON with: overview (string), key_points (array of strings)`,
      response_json_schema: {
        type: "object",
        properties: {
          overview: { type: "string" },
          key_points: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    const ai_overview = overviewResponse.overview;
    const ai_key_points = overviewResponse.key_points || [];

    // STEP 4: Generate labels, priority, category
    const classificationResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Classify this ${isWix ? 'website form submission' : 'email'} for a garage door service company.

${isWix ? 'FORM SUBMISSION' : 'EMAIL'}:
Subject: ${thread.subject}
From: ${thread.from_address}
Customer: ${parsedEmail.customer_name || 'Unknown'}
Description: ${parsedEmail.description || bodyText.substring(0, 500)}

Return JSON with:
- labels: array of 2-5 freeform tags (e.g., ["Quote Request", "Builder", "Urgent", "Motor Fault", "Gate"])
- priority: one of "Low", "Normal", "High", "Critical"
- category: one of "Quote Request", "New Install", "Repair/Service", "Warranty", "Builder Tender", "Strata/Real Estate", "Other"

PRIORITY RULES:
- "Critical": Emergency, safety issue, door stuck open/won't close
- "High": Urgent repairs, time-sensitive, frustrated customer
- "Normal": Standard enquiries
- "Low": General info, future planning

CATEGORY RULES:
- "Quote Request": Asking for a quote or pricing
- "New Install": New garage door, gate, roller shutter installation
- "Repair/Service": Fix broken door, motor, repair request
- "Warranty": Warranty claim or follow-up
- "Builder Tender": Builder project, tender, commercial job
- "Strata/Real Estate": Strata plan, real estate, property manager
- "Other": Everything else`,
      response_json_schema: {
        type: "object",
        properties: {
          labels: {
            type: "array",
            items: { type: "string" }
          },
          priority: {
            type: "string",
            enum: ["Low", "Normal", "High", "Critical"]
          },
          category: {
            type: "string",
            enum: [
              "Quote Request",
              "New Install",
              "Repair/Service",
              "Warranty",
              "Builder Tender",
              "Strata/Real Estate",
              "Other"
            ]
          }
        }
      }
    });

    const ai_labels = classificationResponse.labels || [];
    const ai_priority = classificationResponse.priority || "Normal";
    const ai_category = classificationResponse.category || "Other";

    // STEP 5: Suggest project/job links
    const ai_suggested_links = await findExistingProjectMatch(base44, parsedEmail);

    // STEP 5.5: Find or create customer
    let suggested_customer_id = null;
    
    if (parsedEmail.customer_email) {
      try {
        // Try to find existing customer by email
        const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
          email: parsedEmail.customer_email
        });

        if (existingCustomers.length > 0) {
          // Use existing customer
          suggested_customer_id = existingCustomers[0].id;
        } else if (parsedEmail.customer_name) {
          // Create new customer
          const newCustomer = await base44.asServiceRole.entities.Customer.create({
            name: parsedEmail.customer_name,
            email: parsedEmail.customer_email,
            phone: parsedEmail.customer_phone || null,
            source: isWix ? parsedEmail.source : null,
            source_details: isWix ? parsedEmail.source : null,
            customer_type: 'Owner',
            address_full: parsedEmail.address || null
          });
          suggested_customer_id = newCustomer.id;
        }
      } catch (error) {
        console.error('Error creating/finding customer:', error);
      }
    }

    // STEP 6: Build suggested project fields
    let suggested_project_type = "Garage Door Install";
    
    // Infer from category
    if (ai_category === "New Install") {
      suggested_project_type = "Garage Door Install";
    } else if (ai_category === "Repair/Service") {
      suggested_project_type = "Repair";
    } else if (ai_category === "Builder Tender") {
      suggested_project_type = "Multiple";
    }

    // Refine from labels
    if (ai_labels.some(l => l.toLowerCase().includes('gate'))) {
      suggested_project_type = "Gate Install";
    } else if (ai_labels.some(l => l.toLowerCase().includes('roller'))) {
      suggested_project_type = "Roller Shutter Install";
    } else if (ai_labels.some(l => l.toLowerCase().includes('motor'))) {
      suggested_project_type = "Motor/Accessory";
    }

    const ai_suggested_project_fields = {
      suggested_title: parsedEmail.title || thread.subject || "New enquiry",
      suggested_customer_id: suggested_customer_id,
      suggested_customer_name: parsedEmail.customer_name,
      suggested_customer_email: parsedEmail.customer_email || thread.from_address,
      suggested_customer_phone: parsedEmail.customer_phone,
      suggested_project_type: suggested_project_type,
      suggested_description: parsedEmail.description || bodyText.substring(0, 500),
      suggested_address: parsedEmail.address
    };

    // STEP 7: Update EmailThread
    const now = new Date().toISOString();

    await base44.asServiceRole.entities.EmailThread.update(email_thread_id, {
      ai_overview,
      ai_key_points,
      ai_labels,
      ai_priority,
      ai_category,
      ai_suggested_project_fields,
      ai_suggested_links,
      ai_analyzed_at: now
    });

    // Fetch and return updated thread
    const updatedThread = await base44.asServiceRole.entities.EmailThread.get(email_thread_id);

    return Response.json({
      success: true,
      thread: updatedThread,
      is_wix_email: isWix
    });

  } catch (error) {
    console.error('Error processing email thread with AI:', error);
    return Response.json({ 
      success: false,
      error: error.message || 'An error occurred while processing the email with AI' 
    }, { status: 200 });
  }
});