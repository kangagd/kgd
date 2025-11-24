import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const body = await req.json();
    const { batch_size = 10 } = body;

    // Fetch threads that need tagging (no category or old category)
    const allThreads = await base44.asServiceRole.entities.EmailThread.list('-created_date', 50);
    
    const threadsToTag = allThreads.filter(t => 
      !t.category || t.category === 'Uncategorized' || !t.tags || t.tags.length === 0
    );

    if (threadsToTag.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'All threads are already tagged',
        processed: 0 
      });
    }

    let processed = 0;
    const threadsToProcess = threadsToTag.slice(0, batch_size);

    for (const thread of threadsToProcess) {
      try {
        // Fetch messages for this thread
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        });

        // Combine message content for analysis
        const fullContent = messages
          .map(m => `From: ${m.from_address}\nSubject: ${m.subject}\n${m.body_text?.substring(0, 500) || ''}`)
          .join('\n\n---\n\n');

        // AI analysis
        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Analyze this email thread from a garage door service company and provide comprehensive categorization.

Email Thread:
Subject: ${thread.subject}
From: ${thread.from_address}
Snippet: ${thread.last_message_snippet}

${fullContent.substring(0, 3000)}

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
        await base44.asServiceRole.entities.EmailThread.update(thread.id, {
          category: aiResponse.category || 'Uncategorized',
          tags: aiResponse.tags || [],
          priority: aiResponse.priority || 'Normal',
          is_urgent: aiResponse.is_urgent || false,
          urgency_reason: aiResponse.urgency_reason || null
        });

        processed++;
      } catch (error) {
        console.error(`Failed to tag thread ${thread.id}:`, error);
        // Continue with next thread
      }
    }

    return Response.json({
      success: true,
      processed,
      remaining: threadsToTag.length - processed,
      message: `Tagged ${processed} threads. ${threadsToTag.length - processed} remaining.`
    });
  } catch (error) {
    console.error('Bulk tag error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});