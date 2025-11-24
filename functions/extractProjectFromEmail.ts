import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId, projectId } = await req.json();

    if (!threadId) {
      return Response.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    // Fetch the email thread
    const threads = await base44.entities.EmailThread.filter({ id: threadId });
    if (threads.length === 0) {
      return Response.json({ error: 'Email thread not found' }, { status: 404 });
    }
    const thread = threads[0];

    // Fetch all messages in the thread
    const messages = await base44.entities.EmailMessage.filter({ thread_id: threadId }, 'sent_at');

    // Build context from all messages
    const emailContext = messages.map(msg => {
      const attachmentInfo = msg.attachments && msg.attachments.length > 0
        ? `\nAttachments: ${msg.attachments.map(a => a.filename).join(', ')}`
        : '';
      
      return `
From: ${msg.from_name || msg.from_address} <${msg.from_address}>
To: ${msg.to_addresses?.join(', ') || ''}
Date: ${msg.sent_at}
Subject: ${msg.subject || thread.subject}
${attachmentInfo}

${msg.body_text || msg.body_html?.replace(/<[^>]*>/g, '').substring(0, 2000) || '(No content)'}
---`;
    }).join('\n\n');

    // Use AI to extract project information
    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are analyzing an email thread for a garage door service company (Kangaroo Garage Doors).
Extract project information from this email conversation to help create or update a project record.

EMAIL THREAD:
Subject: ${thread.subject}
${emailContext}

Extract the following information. Be precise and only include information that is clearly stated or strongly implied:

1. Customer name: Look in the email signature, sender name, or body
2. Customer email: The sender's email address
3. Customer phone: Look in the signature or body for phone numbers (Australian format preferred)
4. Site address: Any address mentioned for the work location (Australian addresses)
5. Project description: A 1-3 sentence summary of what the customer needs
6. Project type: Categorize as one of: "Garage Door Install", "Gate Install", "Roller Shutter Install", "Motor/Accessory", "Repair", "Maintenance", or "Multiple"
7. Priority: Rate as "Low", "Normal", "High", or "Urgent" based on urgency words like "stuck", "broken", "emergency", "asap", "not working"
8. Suggested stage: "Lead" for new inquiries, "Initial Site Visit" if they've requested a quote or inspection
9. Requested timeframe: Any mentioned dates or timeframes like "next week", "Friday", "urgent"
10. Summary: A concise 2-3 sentence summary of the situation for the project notes

Also analyze the attachments list - note if there are quotes, photos, or plans mentioned.

Provide your confidence level (0-1) based on how much information was clearly available.`,
      response_json_schema: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          customer_phone: { type: "string" },
          site_address: { type: "string" },
          project_description: { type: "string" },
          project_type: { 
            type: "string",
            enum: ["Garage Door Install", "Gate Install", "Roller Shutter Install", "Motor/Accessory", "Repair", "Maintenance", "Multiple"]
          },
          priority: {
            type: "string",
            enum: ["Low", "Normal", "High", "Urgent"]
          },
          suggested_stage: {
            type: "string",
            enum: ["Lead", "Initial Site Visit"]
          },
          requested_timeframe: { type: "string" },
          summary: { type: "string" },
          attachment_notes: { type: "string" },
          confidence_score: { type: "number" }
        }
      }
    });

    // Create the AI insight record
    const insight = await base44.entities.ProjectAIInsight.create({
      project_id: projectId || null,
      email_thread_id: threadId,
      summary: aiResponse.summary || '',
      suggested_fields: JSON.stringify(aiResponse),
      customer_name: aiResponse.customer_name || '',
      customer_email: aiResponse.customer_email || thread.from_address || '',
      customer_phone: aiResponse.customer_phone || '',
      site_address: aiResponse.site_address || '',
      project_description: aiResponse.project_description || '',
      project_type: aiResponse.project_type || '',
      priority: aiResponse.priority || 'Normal',
      suggested_stage: aiResponse.suggested_stage || 'Lead',
      requested_timeframe: aiResponse.requested_timeframe || '',
      confidence_score: aiResponse.confidence_score || 0.5,
      created_by_ai_model: 'gpt-4o-mini',
      is_applied: false
    });

    // If there's an existing project, update its AI fields
    if (projectId) {
      await base44.entities.Project.update(projectId, {
        ai_email_summary: aiResponse.summary,
        ai_key_requirements: JSON.stringify({
          customer_name: aiResponse.customer_name,
          customer_phone: aiResponse.customer_phone,
          site_address: aiResponse.site_address,
          project_description: aiResponse.project_description,
          priority: aiResponse.priority,
          requested_timeframe: aiResponse.requested_timeframe,
          attachment_notes: aiResponse.attachment_notes
        }),
        ai_suggested_project_type: aiResponse.project_type,
        ai_suggested_stage: aiResponse.suggested_stage,
        ai_source_email_thread_id: threadId,
        ai_last_updated_at: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      insight: insight,
      suggestions: aiResponse
    });

  } catch (error) {
    console.error('Error extracting project from email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});