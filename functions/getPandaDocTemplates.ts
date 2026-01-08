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
      return Response.json({ error: 'Only admins can view templates' }, { status: 403 });
    }

    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    // Fetch templates from PandaDoc
    const response = await fetch(`${PANDADOC_API_URL}/templates`, {
      headers: {
        'Authorization': `API-Key ${PANDADOC_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ 
        error: 'Failed to fetch templates', 
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();

    // Return simplified template list
    const templates = (data.results || []).map(template => ({
      id: template.id,
      name: template.name,
      date_created: template.date_created,
      date_modified: template.date_modified
    }));

    return Response.json({
      success: true,
      templates: templates
    });

  } catch (error) {
    console.error('getPandaDocTemplates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});