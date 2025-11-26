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

    if (!recipientEmail) {
      return Response.json({ error: 'recipientEmail is required' }, { status: 400 });
    }

    // Step 1: Get document details to check status and recipients
    const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}`, {
      headers: { 'Authorization': `API-Key ${PANDADOC_API_KEY}` }
    });
    
    if (!docResponse.ok) {
      const errorText = await docResponse.text();
      console.error('PandaDoc document fetch error:', errorText);
      return Response.json({ error: 'Failed to fetch document details', details: errorText }, { status: docResponse.status });
    }
    
    const docData = await docResponse.json();
    console.log('Document status:', docData.status, 'ID:', documentId);
    console.log('Document recipients:', JSON.stringify(docData.recipients));

    // Step 2: Create a session for the recipient using the Session API
    const sessionResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/session`, {
      method: 'POST',
      headers: { 
        'Authorization': `API-Key ${PANDADOC_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: recipientEmail,
        lifetime: 86400 // 24 hours
      })
    });

    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('Session created:', JSON.stringify(sessionData));
      
      // PandaDoc returns different fields - check for the actual token/link
      if (sessionData.expires_at && sessionData.id) {
        // The session endpoint returns a view_url or we construct from the session id
        const publicUrl = sessionData.view_url || `https://app.pandadoc.com/s/${sessionData.id}`;
        return Response.json({ success: true, public_url: publicUrl, method: 'session_api', session_data: sessionData });
      }
    }

    const sessionError = await sessionResponse.text();
    console.error('Session API error:', sessionError);
    return Response.json({ 
      error: 'Failed to create session link', 
      details: sessionError,
      hint: 'Ensure the recipient email matches exactly what is in PandaDoc'
    }, { status: 400 });

  } catch (error) {
    console.error('getPandaDocSessionLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});