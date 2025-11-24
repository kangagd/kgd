import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id } = await req.json();

    if (!thread_id) {
      return Response.json({ error: 'thread_id required' }, { status: 400 });
    }

    // Fetch thread and messages
    const thread = await base44.asServiceRole.entities.EmailThread.filter({ id: thread_id });
    if (!thread || thread.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const emailThread = thread[0];
    const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
      thread_id: thread_id 
    });

    // Combine message content for analysis
    const fullContent = messages
      .map(m => `From: ${m.from_address}\nSubject: ${m.subject}\n${m.body_text || m.body_html || ''}`)
      .join('\n\n---\n\n');

    // AI analysis
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this email thread from a garage door service company and provide comprehensive categorization.

Email Thread:
${fullContent.substring(0, 4000)}

Tasks:
1. Assign ONE primary category from: Customer Inquiry, Quote Request, Job Update, Technical Issue, Payment/Invoice, Complaint, Warranty Claim, Parts Order, Installation, Repair, Maintenance, Follow-up, General/Other

2. Generate 2-5 relevant tags from: urgent, new-customer, existing-customer, quote-needed, technical, scheduling, pricing, warranty, installation, repair, emergency, follow-up, complaint, payment, invoice, parts, residential, commercial, garage-door, gate, roller-shutter, motor, remote, service-call

3. Determine priority (High/Normal/Low):
   - HIGH: Urgent issues, safety concerns, complaints, job delays, payment disputes, emergency repairs
   - NORMAL: General inquiries, scheduling, routine updates, quote requests
   - LOW: Marketing, newsletters, informational, non-urgent admin

4. Detect urgency: Mark as urgent if time-sensitive, safety issue, angry customer, or broken equipment

Return JSON with: category (string), tags (array of strings), priority (High/Normal/Low), is_urgent (boolean), urgency_reason (string if urgent, else null)`,
      response_json_schema: {
        type: "object",
        properties: {
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["High", "Normal", "Low"] },
          is_urgent: { type: "boolean" },
          urgency_reason: { type: "string" }
        }
      }
    });

    // Update thread with AI tags
    await base44.asServiceRole.entities.EmailThread.update(thread_id, {
      category: aiResponse.category || emailThread.category || 'Uncategorized',
      tags: aiResponse.tags || [],
      priority: aiResponse.priority || emailThread.priority || 'Normal',
      is_urgent: aiResponse.is_urgent || false,
      urgency_reason: aiResponse.urgency_reason || null
    });

    return Response.json({
      success: true,
      category: aiResponse.category,
      tags: aiResponse.tags,
      priority: aiResponse.priority,
      is_urgent: aiResponse.is_urgent
    });
  } catch (error) {
    console.error('Auto-tag error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});