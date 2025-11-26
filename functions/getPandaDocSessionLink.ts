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

    // First get document details
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
    console.log('Document status:', docData.status, 'Document ID:', documentId);
    console.log('Full document data:', JSON.stringify(docData));
    
    // Try multiple ways to find recipient email from PandaDoc
    // PandaDoc can store recipients in different places depending on document type
    let pandaDocRecipient = null;
    
    // Try recipients array first
    if (docData.recipients && docData.recipients.length > 0) {
      pandaDocRecipient = docData.recipients[0].email;
    }
    // Try roles array (some document types use this)
    else if (docData.roles && docData.roles.length > 0) {
      const roleWithEmail = docData.roles.find(r => r.email);
      if (roleWithEmail) {
        pandaDocRecipient = roleWithEmail.email;
      }
    }
    // Try linked_objects for contact info
    else if (docData.linked_objects && docData.linked_objects.length > 0) {
      const contact = docData.linked_objects.find(o => o.entity_type === 'contact');
      if (contact && contact.email) {
        pandaDocRecipient = contact.email;
      }
    }
    
    // Fallback to the email passed from our database
    if (!pandaDocRecipient && recipientEmail) {
      console.log('Using fallback recipientEmail from database:', recipientEmail);
      pandaDocRecipient = recipientEmail;
    }
    
    if (!pandaDocRecipient) {
      console.error('No recipient email found anywhere for document:', documentId);
      return Response.json({ 
        error: 'No recipient email found. Please add a recipient to the document in PandaDoc.',
        debug: {
          recipients: docData.recipients,
          roles: docData.roles,
          status: docData.status
        }
      }, { status: 400 });
    }
    
    const recipientToUse = pandaDocRecipient;
    console.log('Using recipient:', recipientToUse);

    // Try to get sharing link first (works more reliably)
    try {
      const sharingResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/links`, {
        headers: {
          'Authorization': `API-Key ${PANDADOC_API_KEY}`
        }
      });
      
      if (sharingResponse.ok) {
        const links = await sharingResponse.json();
        console.log('Sharing links response:', JSON.stringify(links));
        
        // Find a link for the recipient or the first available link
        const recipientLink = links.find(l => l.recipient === recipientToUse) || links[0];
        if (recipientLink && recipientLink.link) {
          return Response.json({
            success: true,
            public_url: recipientLink.link,
            method: 'sharing_link'
          });
        }
      }
    } catch (linkError) {
      console.log('Sharing links not available, trying session:', linkError.message);
    }

    // Fallback: Try session API with exact PandaDoc recipient
    console.log('Creating session for document:', documentId, 'recipient:', recipientToUse);

    const sessionResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: recipientToUse,
        lifetime: 86400
      })
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('PandaDoc session error:', errorText, 'Status:', sessionResponse.status);
      
      // If session fails, try to create a sharing link
      try {
        const createLinkResponse = await fetch(`${PANDADOC_API_URL}/documents/${documentId}/links`, {
          method: 'POST',
          headers: {
            'Authorization': `API-Key ${PANDADOC_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: recipientToUse,
            lifetime: 86400
          })
        });
        
        if (createLinkResponse.ok) {
          const linkData = await createLinkResponse.json();
          console.log('Created sharing link:', JSON.stringify(linkData));
          if (linkData.link) {
            return Response.json({
              success: true,
              public_url: linkData.link,
              method: 'created_sharing_link'
            });
          }
        } else {
          const createLinkError = await createLinkResponse.text();
          console.error('Failed to create sharing link:', createLinkError);
        }
      } catch (createLinkErr) {
        console.error('Error creating sharing link:', createLinkErr.message);
      }
      
      return Response.json({ 
        error: 'Failed to create client link', 
        details: `Session API error: ${errorText}. Document status: ${docData.status}. Make sure the document has been sent to recipients.`
      }, { status: sessionResponse.status });
    }

    const sessionData = await sessionResponse.json();
    console.log('PandaDoc session response:', JSON.stringify(sessionData));
    
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
      method: 'session',
      expires_in: 86400
    });

  } catch (error) {
    console.error('getPandaDocSessionLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});