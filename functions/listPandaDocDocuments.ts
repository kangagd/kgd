import { createClientFromRequest } from './shared/sdk.js';

const PANDADOC_API_KEY = Deno.env.get("PANDADOC_API_KEY");
const PANDADOC_API_URL = "https://api.pandadoc.com/public/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can list documents' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { search, status, count = 50, projectId = null } = body;

    // Build query params
    const params = new URLSearchParams();
    params.append('count', count.toString());
    if (search) params.append('q', search);
    if (status) params.append('status', status);

    // Fetch documents from PandaDoc
    const response = await fetch(`${PANDADOC_API_URL}/documents?${params.toString()}`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ 
        error: 'Failed to fetch documents', 
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();

    // Get ALL existing linked document IDs (to show if doc is linked anywhere)
    const existingQuotes = await base44.entities.Quote.list();
    const linkedDocIds = new Set(existingQuotes.map(q => q.pandadoc_document_id).filter(Boolean));

    // Return simplified document list with linked status
    const documents = (data.results || []).map(doc => ({
      id: doc.id,
      name: doc.name,
      status: doc.status,
      date_created: doc.date_created,
      date_modified: doc.date_modified,
      grand_total: doc.grand_total,
      recipients: doc.recipients,
      is_linked: linkedDocIds.has(doc.id)
    }));

    return Response.json({
      success: true,
      documents: documents
    });

  } catch (error) {
    console.error('listPandaDocDocuments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});