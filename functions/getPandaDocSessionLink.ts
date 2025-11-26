import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
const PANDADOC_API_URL = "https://api.pandadoc.com/public/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { documentId, recipientEmail } = body;

    if (!documentId) {
      return Response.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Create a new session link
    const sessionResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: recipientEmail || '',
        lifetime: 86400 // 24 hours in seconds
      })
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('PandaDoc session error:', errorText);
      return Response.json({ 
        error: 'Failed to create session link', 
        details: errorText 
      }, { status: sessionResponse.status });
    }

    const sessionData = await sessionResponse.json();
    const publicUrl = sessionData.id ? `https://app.pandadoc.com/s/${sessionData.id}` : '';

    return Response.json({
      success: true,
      public_url: publicUrl,
      expires_in: 86400
    });

  } catch (error) {
    console.error('getPandaDocSessionLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});