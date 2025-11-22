import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the API key from environment
        const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
        
        if (!apiKey) {
            console.error('GOOGLE_MAPS_API_KEY not found in environment');
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }

        return Response.json({ apiKey }, { status: 200 });
    } catch (error) {
        console.error('Error in getGoogleMapsKey:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});