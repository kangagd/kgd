import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message_id, thread_id } = await req.json();

    if (!message_id && !thread_id) {
      return Response.json({ error: 'message_id or thread_id required' }, { status: 400 });
    }

    const results = {
      messages_processed: 0,
      threads_processed: 0,
      errors: []
    };

    // Process specific message
    if (message_id) {
      try {
        const message = await base44.asServiceRole.entities.EmailMessage.get(message_id);
        await processMessage(base44, message);
        results.messages_processed = 1;
      } catch (error) {
        results.errors.push({ message_id, error: error.message });
      }
    }

    // Process thread (all messages + thread summary)
    if (thread_id) {
      try {
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({ thread_id }, 'sent_at');
        
        // Process each message
        for (const message of messages) {
          try {
            await processMessage(base44, message);
            results.messages_processed++;
          } catch (error) {
            results.errors.push({ message_id: message.id, error: error.message });
          }
        }

        // Process thread summary
        await processThread(base44, thread_id, messages);
        results.threads_processed = 1;
      } catch (error) {
        results.errors.push({ thread_id, error: error.message });
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processMessage(base44, message) {
  // Skip if recently processed (within last hour)
  if (message.ai_last_processed_at) {
    const lastProcessed = new Date(message.ai_last_processed_at);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (lastProcessed > hourAgo) {
      return;
    }
  }

  // Generate plain text body if not already done
  let plainTextBody = message.plain_text_body;
  if (!plainTextBody && message.body_html) {
    plainTextBody = message.body_html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit for AI processing
  } else if (!plainTextBody) {
    plainTextBody = message.body_text?.substring(0, 5000) || '';
  }

  // Build AI prompt
  const emailContent = `
Subject: ${message.subject || '(No Subject)'}
From: ${message.from_name || message.from_address}
Date: ${message.sent_at}

${plainTextBody}
`;

  // Call AI to analyze
  const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are analyzing an email for a garage door and gate service company. Extract structured insights.

Email:
${emailContent}

Provide:
1. A concise summary (2-3 sentences max)
2. Key points as bullet points (max 5)
3. Extracted entities: contact names, phone numbers, addresses, requested dates, budget mentions, company names
4. Suggested actions: what should the team do next? (e.g., create_project, create_job, follow_up_email, schedule_site_visit, send_quote)
5. Sentiment: positive, neutral, negative, mixed, or unknown
6. Importance score: 0-1 (0=low priority, 1=urgent)

Focus on operational details relevant to service scheduling, quotes, installations, and customer service.`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
        extracted_entities: {
          type: "object",
          properties: {
            contact_name: { type: "string" },
            phone_numbers: { type: "array", items: { type: "string" } },
            addresses: { type: "array", items: { type: "string" } },
            requested_dates: { type: "array", items: { type: "string" } },
            budget_mentions: { type: "array", items: { type: "string" } },
            company_name: { type: "string" }
          }
        },
        suggested_actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              reason: { type: "string" }
            }
          }
        },
        sentiment: { type: "string" },
        importance_score: { type: "number" }
      }
    }
  });

  // Update message with AI insights
  await base44.asServiceRole.entities.EmailMessage.update(message.id, {
    plain_text_body: plainTextBody,
    ai_summary: aiResponse.summary || null,
    ai_key_points: aiResponse.key_points || [],
    ai_extracted_entities: aiResponse.extracted_entities || {},
    ai_suggested_actions: aiResponse.suggested_actions || [],
    ai_sentiment: aiResponse.sentiment || 'unknown',
    ai_importance_score: aiResponse.importance_score || 0,
    ai_last_processed_at: new Date().toISOString()
  });
}

async function processThread(base44, threadId, messages) {
  if (messages.length === 0) return;

  // Skip if recently processed (within last 2 hours)
  const thread = await base44.asServiceRole.entities.EmailThread.get(threadId);
  if (thread.ai_last_processed_at) {
    const lastProcessed = new Date(thread.ai_last_processed_at);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (lastProcessed > twoHoursAgo) {
      return;
    }
  }

  // Build conversation summary
  const conversationText = messages
    .slice(-10) // Last 10 messages
    .map((msg, idx) => {
      const body = msg.plain_text_body || msg.body_text || '';
      return `Message ${idx + 1} (${msg.is_outbound ? 'Sent' : 'Received'} - ${new Date(msg.sent_at).toLocaleDateString()}):\n${body.substring(0, 800)}`;
    })
    .join('\n\n---\n\n');

  const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are analyzing an email conversation thread for a garage door and gate service company.

Conversation:
${conversationText}

Provide:
1. A high-level summary of the entire conversation (3-4 sentences)
2. Key points across all messages (max 7 bullets)

Focus on the customer's needs, any commitments made, next steps, and important details.`,
    response_json_schema: {
      type: "object",
      properties: {
        thread_summary: { type: "string" },
        thread_key_points: { type: "array", items: { type: "string" } }
      }
    }
  });

  // Update thread with AI insights
  await base44.asServiceRole.entities.EmailThread.update(threadId, {
    ai_thread_summary: aiResponse.thread_summary || null,
    ai_thread_key_points: aiResponse.thread_key_points || [],
    ai_last_processed_at: new Date().toISOString()
  });
}