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

    // First get document details to find recipient email (required by PandaDoc API)
    const docResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });
    
    if (!docResponse.ok) {
      const errorText = await docResponse.text();
      console.error('PandaDoc document fetch error:', errorText);
      return Response.json({ 
        error: 'Failed to fetch document details', 
        details: errorText 
      }, { status: docResponse.status });
    }
    
    const docData = await docResponse.json();
    // Get first recipient's email - this is REQUIRED for session creation
    const recipientToUse = recipientEmail || docData.recipients?.[0]?.email;
    
    if (!recipientToUse) {
      console.error('No recipient email found for document:', documentId, 'doc data:', JSON.stringify(docData));
      return Response.json({ 
        error: 'No recipient email found for this document' 
      }, { status: 400 });
    }

    console.log('Creating session for document:', documentId, 'recipient:', recipientToUse);

    // Create a new session link
    const sessionResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: recipientToUse,
        lifetime: 86400 // 24 hours in seconds
      })
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('PandaDoc session error:', errorText, 'for document:', documentId, 'recipient:', recipientToUse);
      return Response.json({ 
        error: 'Failed to create session link', 
        details: errorText 
      }, { status: sessionResponse.status });
    }

    const sessionData = await sessionResponse.json();
    console.log('PandaDoc session response:', JSON.stringify(sessionData));
    
    // PandaDoc returns id which is used as token in the URL
    const token = sessionData.id;
    if (!token) {
      console.error('No session ID in response:', JSON.stringify(sessionData));
      return Response.json({ 
        error: 'No session ID returned from PandaDoc' 
      }, { status: 500 });
    }
    
    const publicUrl = `https://app.pandadoc.com/document/v2?token=${token}`;

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