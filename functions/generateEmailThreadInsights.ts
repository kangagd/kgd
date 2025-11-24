import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

3. Suggest project fields if this thread could become a project:
   - suggested_title: A clear project title
   - suggested_description: What work needs to be done
   - suggested_project_type: One of "Garage Door Install", "Gate Install", "Roller Shutter Install", "Multiple", "Motor/Accessory", "Repair", "Maintenance"
   - suggested_customer_name: Customer's name if mentioned
   - suggested_customer_email: Customer's email if available
   - suggested_customer_phone: Phone number if mentioned
   - suggested_address: Property address if mentioned
   - suggested_products: Array of products mentioned (e.g., ["Garage Door", "Motor", "Remote"])
   - suggested_priority: "Low", "Normal", or "High" based on urgency

Return JSON with: summary (string), key_points (array of strings), suggested_project_fields (object with the fields above, use null for unknown fields)`,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          key_points: { 
            type: "array", 
            items: { type: "string" } 
          },
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
        suggested_project_fields: aiResponse.suggested_project_fields || {}
      });
    } else {
      // Create new insight
      insight = await base44.asServiceRole.entities.AIEmailInsight.create({
        email_thread_id: email_thread_id,
        summary: aiResponse.summary,
        key_points: aiResponse.key_points || [],
        suggested_project_fields: aiResponse.suggested_project_fields || {},
        applied_to_project: false
      });
    }

    return Response.json({
      success: true,
      insight_id: insight.id,
      summary: aiResponse.summary,
      key_points: aiResponse.key_points,
      suggested_project_fields: aiResponse.suggested_project_fields,
      analyzed_at: now
    });

  } catch (error) {
    console.error('Error generating email insights:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});