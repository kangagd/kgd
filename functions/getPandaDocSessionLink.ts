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
    const { documentId } = body;

    if (!documentId) {
      return Response.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Step 1: Get document details to check status
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

    // Step 2: Try to get existing sharing links
    const existingLinksResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/links`, {
      headers: { 'Authorization': `API-Key ${PANDADOC_API_KEY}` }
    });
    
    if (existingLinksResponse.ok) {
      const links = await existingLinksResponse.json();
      console.log('Existing links:', JSON.stringify(links));
      
      if (links && links.length > 0 && links[0].link) {
        console.log('Using existing link');
        return Response.json({ success: true, public_url: links[0].link, method: 'existing_link' });
      }
    }

    // Step 3: Create a new sharing link (public, no recipient required)
    const createLinkResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/links`, {
      method: 'POST',
      headers: { 
        'Authorization': `API-Key ${PANDADOC_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ lifetime: 86400 })
    });
    
    if (createLinkResponse.ok) {
      const linkData = await createLinkResponse.json();
      console.log('Created link:', JSON.stringify(linkData));
      if (linkData.link) {
        return Response.json({ success: true, public_url: linkData.link, method: 'created_link' });
      }
    }

    const createLinkError = await createLinkResponse.text();
    console.error('Failed to create sharing link:', createLinkError);

    // Step 4: If sharing links don't work, construct the direct PandaDoc URL
    // This is a fallback that opens the document in PandaDoc's viewer
    const directUrl = `https://app.pandadoc.com/a/#/documents/${documentId}`;
    console.log('Using direct PandaDoc URL as fallback');
    
    return Response.json({ 
      success: true, 
      public_url: directUrl, 
      method: 'direct_url',
      note: 'Using direct PandaDoc link - recipient may need to log in'
    });

  } catch (error) {
    console.error('getPandaDocSessionLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});