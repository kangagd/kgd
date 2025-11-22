import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId, threadId, forceReprocess = false } = await req.json();

    // Process a single message or all messages in a thread
    if (messageId) {
      const result = await processMessage(base44, messageId, forceReprocess);
      return Response.json(result);
    } else if (threadId) {
      const result = await processThread(base44, threadId, forceReprocess);
      return Response.json(result);
    } else {
      return Response.json({ error: 'messageId or threadId required' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI processing error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process email with AI',
      details: error.toString()
    }, { status: 500 });
  }
});

async function processMessage(base44, messageId, forceReprocess) {
  const message = await base44.asServiceRole.entities.EmailMessage.filter({ id: messageId });
  if (!message || message.length === 0) {
    throw new Error('Message not found');
  }

  const msg = message[0];

  // Skip if already processed recently (unless forced)
  if (!forceReprocess && msg.ai_last_processed_at) {
    const lastProcessed = new Date(msg.ai_last_processed_at);
    const hoursSinceProcessing = (Date.now() - lastProcessed.getTime()) / (1000 * 60 * 60);
    if (hoursSinceProcessing < 24) {
      return { status: 'skipped', reason: 'already_processed_recently', messageId };
    }
  }

  // Extract plain text if needed
  let plainText = msg.body_text;
  if (!plainText && msg.body_html) {
    plainText = msg.body_html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Prepare email content for AI
  const emailContent = `
From: ${msg.from_name || msg.from_address}
To: ${msg.to_addresses?.join(', ') || 'N/A'}
Subject: ${msg.subject}
Date: ${msg.sent_at}

${plainText || msg.body_html?.substring(0, 2000) || '(No content)'}
`;

  // Call AI to analyze email
  const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an AI assistant for a garage door and gate service company. Analyze this email and extract structured information.

Email:
${emailContent}

Provide:
1. A concise summary (2-3 sentences)
2. Key points (important items mentioned)
3. Extracted entities (contact names, phone numbers, addresses, dates, budget mentions, company name)
4. Suggested actions (e.g., create project, create job, follow up, call customer)
5. Sentiment (positive, neutral, negative, mixed)
6. Importance score (0-1, where 1 is most urgent/important)

Focus on actionable information relevant to field service operations.`,
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
              reason: { type: "string" },
              priority: { type: "string" }
            }
          }
        },
        sentiment: { type: "string" },
        importance_score: { type: "number" }
      }
    }
  });

  // Update message with AI insights
  await base44.asServiceRole.entities.EmailMessage.update(messageId, {
    ai_summary: analysis.summary,
    ai_key_points: analysis.key_points || [],
    ai_extracted_entities: analysis.extracted_entities || {},
    ai_suggested_actions: analysis.suggested_actions || [],
    ai_sentiment: analysis.sentiment || 'unknown',
    ai_importance_score: analysis.importance_score || 0.5,
    ai_last_processed_at: new Date().toISOString()
  });

  return { 
    status: 'success', 
    messageId,
    analysis: {
      summary: analysis.summary,
      importance_score: analysis.importance_score,
      sentiment: analysis.sentiment
    }
  };
}

async function processThread(base44, threadId, forceReprocess) {
  const thread = await base44.asServiceRole.entities.EmailThread.filter({ id: threadId });
  if (!thread || thread.length === 0) {
    throw new Error('Thread not found');
  }

  const threadData = thread[0];

  // Skip if already processed recently (unless forced)
  if (!forceReprocess && threadData.ai_last_processed_at) {
    const lastProcessed = new Date(threadData.ai_last_processed_at);
    const hoursSinceProcessing = (Date.now() - lastProcessed.getTime()) / (1000 * 60 * 60);
    if (hoursSinceProcessing < 24) {
      return { status: 'skipped', reason: 'already_processed_recently', threadId };
    }
  }

  // Get all messages in thread
  const messages = await base44.asServiceRole.entities.EmailMessage.filter(
    { thread_id: threadId },
    'sent_at'
  );

  if (messages.length === 0) {
    return { status: 'skipped', reason: 'no_messages', threadId };
  }

  // Process individual messages first (if not already processed)
  const messageResults = [];
  for (const msg of messages) {
    try {
      const result = await processMessage(base44, msg.id, false);
      messageResults.push(result);
    } catch (error) {
      console.error(`Failed to process message ${msg.id}:`, error);
    }
  }

  // Now create thread-level summary
  const threadContent = messages.map((msg, idx) => {
    const plainText = msg.body_text || msg.body_html?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return `Message ${idx + 1} (${msg.is_outbound ? 'Sent' : 'Received'} - ${msg.sent_at}):\nFrom: ${msg.from_address}\nSubject: ${msg.subject}\n${plainText?.substring(0, 500) || '(No content)'}\n`;
  }).join('\n---\n');

  const threadAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an AI assistant for a garage door and gate service company. Analyze this email thread conversation and provide a high-level summary.

Thread Subject: ${threadData.subject}

Messages:
${threadContent}

Provide:
1. A thread-level summary (what is this conversation about overall?)
2. Key points across the entire thread (decisions made, action items, important information)

Keep it concise and actionable.`,
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
    ai_thread_summary: threadAnalysis.thread_summary,
    ai_thread_key_points: threadAnalysis.thread_key_points || [],
    ai_last_processed_at: new Date().toISOString()
  });

  return {
    status: 'success',
    threadId,
    messagesProcessed: messageResults.length,
    analysis: {
      thread_summary: threadAnalysis.thread_summary,
      key_points_count: threadAnalysis.thread_key_points?.length || 0
    }
  };
}