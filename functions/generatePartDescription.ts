import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { category, supplier_name, source_type, status, order_reference } = await req.json();

        const prompt = `
            Generate a concise, professional description or note for a construction/garage door part with the following details:
            - Category: ${category || 'Unknown'}
            - Supplier: ${supplier_name || 'Unknown'}
            - Source Type: ${source_type || 'Unknown'}
            - Status: ${status || 'Unknown'}
            - Order Reference: ${order_reference || 'N/A'}

            The description should be suitable for a logistics or project management system. 
            Focus on what the part likely is based on the category and its current logistics status.
            Keep it under 50 words. 
            Do not include "Here is a description" or quotes. Just the text.
        `;

        const description = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            add_context_from_internet: false
        });

        return Response.json({ description });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});