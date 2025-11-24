import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = await req.json();

    if (!threadId) {
      return Response.json({ error: 'Thread ID required' }, { status: 400 });
    }

    // Get thread and its messages
    const thread = await base44.asServiceRole.entities.EmailThread.filter({ id: threadId });
    if (!thread || thread.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const messages = await base44.asServiceRole.entities.EmailMessage.filter({ thread_id: threadId }, 'sent_at');
    
    // Build context for AI analysis
    const emailContext = {
      subject: thread[0].subject,
      from: thread[0].from_address,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.body_text || messages[messages.length - 1]?.body_html?.substring(0, 500),
      hasAttachments: messages.some(m => m.attachments && m.attachments.length > 0),
      linkedProject: thread[0].linked_project_id ? true : false,
      linkedJob: thread[0].linked_job_id ? true : false
    };

    // Use AI to determine priority
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this email thread from a garage door service company and determine its priority level.

Email Details:
- Subject: ${emailContext.subject}
- From: ${emailContext.from}
- Messages: ${emailContext.messageCount}
- Has Attachments: ${emailContext.hasAttachments}
- Linked to Project: ${emailContext.linkedProject}
- Linked to Job: ${emailContext.linkedJob}
- Latest Message Excerpt: ${emailContext.lastMessage}

Priority Guidelines:
- HIGH: Urgent issues, safety concerns, customer complaints, job delays, payment issues, time-sensitive quotes
- NORMAL: General inquiries, follow-ups, scheduling requests, routine updates
- LOW: Marketing emails, newsletters, informational content, non-urgent administrative emails

Return only: High, Normal, or Low`,
      response_json_schema: {
        type: "object",
        properties: {
          priority: { 
            type: "string",
            enum: ["High", "Normal", "Low"]
          },
          reasoning: { type: "string" }
        }
      }
    });

    // Update thread with AI-determined priority
    await base44.asServiceRole.entities.EmailThread.update(threadId, {
      priority: aiResponse.priority
    });

    return Response.json({
      priority: aiResponse.priority,
      reasoning: aiResponse.reasoning
    });

  } catch (error) {
    console.error('Error prioritizing email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});