import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_url } = await req.json();

    if (!image_url) {
      return Response.json({ error: 'image_url is required' }, { status: 400 });
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this photo or video and determine if it's suitable for marketing use. 
      
      Marketing-suitable content should be:
      - Professional quality (good lighting, clear focus, not blurry)
      - Show completed/finished work (not in-progress or messy)
      - Visually appealing and presentable to customers
      - Free of inappropriate content
      - Show products/installations in their best light
      - For videos: smooth footage, good audio quality (if applicable)
      
      Return your analysis.`,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          is_marketing_approved: {
            type: "boolean",
            description: "Whether the photo is suitable for marketing"
          },
          quality_score: {
            type: "number",
            description: "Quality score from 1-10"
          },
          reason: {
            type: "string",
            description: "Brief explanation of the decision"
          },
          suggested_tags: {
            type: "array",
            items: { type: "string" },
            description: "Suggested tags for the photo"
          }
        },
        required: ["is_marketing_approved", "quality_score", "reason"]
      }
    });

    return Response.json(result);
  } catch (error) {
    console.error('Error analyzing photo:', error);
    return Response.json({ 
      error: error.message || 'Failed to analyze photo',
      is_marketing_approved: false,
      reason: 'Analysis failed'
    }, { status: 500 });
  }
});