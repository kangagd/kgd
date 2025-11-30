import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { email_id, project_id } = await req.json();
        if (!email_id || !project_id) return Response.json({ error: 'Missing required fields' }, { status: 400 });

        // 1. Fetch Email Content
        // email_id could be thread_id or message_id? Let's assume thread_id and get context.
        // We'll fetch messages for the thread.
        const messages = await base44.asServiceRole.entities.EmailMessage.filter({ thread_id: email_id });
        if (!messages || messages.length === 0) {
             return Response.json({ error: 'No messages found for this email thread' }, { status: 404 });
        }

        // Concatenate messages for context (limit to last 3-5 or total chars to avoid token limits if huge)
        const emailContent = messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at))
            .map(m => `From: ${m.from_address}\nBody: ${m.body_text || m.body_snippet}`)
            .join('\n\n---\n\n');

        // 2. AI Extraction
        const prompt = `
        You are an AI assistant extracting structured project details from an email thread.
        Extract the following fields:
        - issue_summary: A concise summary of the customer's issue or request (1-2 sentences).
        - address: The service address if mentioned. If not found, return null.
        - items_requested: Key items or services requested (e.g. "Garage Door Repair", "New Remote").
        - urgency_level: "Low", "Medium", or "High" based on customer tone and keywords (e.g. "emergency", "stuck", "asap").
        - initial_notes: Any other relevant details for the technician.

        EMAIL CONTENT:
        ${emailContent}

        Output JSON format:
        {
            "issue_summary": "string",
            "address": "string or null",
            "items_requested": "string",
            "urgency_level": "Low | Medium | High",
            "initial_notes": "string"
        }
        `;

        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    issue_summary: { type: "string" },
                    address: { type: ["string", "null"] },
                    items_requested: { type: "string" },
                    urgency_level: { type: "string", enum: ["Low", "Medium", "High"] },
                    initial_notes: { type: "string" }
                }
            }
        });

        const extracted = llmRes.data || {};

        // 3. Update Project
        // Only update address if project address is empty
        const project = await base44.asServiceRole.entities.Project.get(project_id);
        const updates = {};

        if (extracted.issue_summary) updates.issue_summary = extracted.issue_summary;
        if (extracted.urgency_level) updates.urgency = extracted.urgency_level;
        if (extracted.initial_notes) updates.initial_notes = extracted.initial_notes;
        
        // Only update address if current is empty and extracted is valid
        if (!project.address && extracted.address) {
            updates.address = extracted.address;
            updates.address_full = extracted.address; // Assuming extracted is full
        }

        // Append to description if needed, or just use issue_summary
        if (extracted.items_requested && !project.description) {
            updates.description = extracted.items_requested;
        }

        if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Project.update(project_id, updates);
        }

        return Response.json({ success: true, extracted: updates });

    } catch (error) {
        console.error("AI Project Context Extraction Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});