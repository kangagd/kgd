import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    const stageId = Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID');

    if (!apiToken) {
      return Response.json({ 
        error: 'PIPEDRIVE_API_TOKEN not set',
        stageId: stageId || 'not set'
      });
    }

    // Fetch stages from Pipedrive
    const stagesResponse = await fetch(
      `https://api.pipedrive.com/v1/stages?api_token=${apiToken}`
    );

    if (!stagesResponse.ok) {
      return Response.json({ 
        error: 'Failed to fetch stages from Pipedrive',
        status: stagesResponse.status,
        configuredStageId: stageId || 'not set'
      });
    }

    const stagesData = await stagesResponse.json();

    return Response.json({
      success: true,
      configured: {
        stageId: stageId || 'NOT SET',
        stageIdType: typeof stageId,
        stageIdParsed: parseInt(stageId || '0')
      },
      stages: stagesData.data.map(stage => ({
        id: stage.id,
        name: stage.name,
        pipeline_name: stage.pipeline_name,
        matches: stage.id === parseInt(stageId || '0')
      })),
      instructions: 'Find "Job Booked" stage above and set PIPEDRIVE_JOB_BOOKED_STAGE_ID to its id value'
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});