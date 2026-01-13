import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    // Test 1: Check if API token is set
    const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    if (!apiToken) {
      return Response.json({
        success: false,
        error: 'PIPEDRIVE_API_TOKEN not set',
        tests: {
          api_token: 'FAILED - Token not found'
        }
      });
    }

    // Test 2: Try to fetch deals from Pipedrive
    let pipedriveConnection = 'FAILED';
    let dealCount = 0;
    try {
      const response = await fetch(
        `https://api.pipedrive.com/v1/deals?limit=1&api_token=${apiToken}`
      );
      const result = await response.json();
      if (result.success) {
        pipedriveConnection = 'SUCCESS';
        dealCount = result.data?.length || 0;
      } else {
        pipedriveConnection = `FAILED - ${result.error || 'Unknown error'}`;
      }
    } catch (error) {
      pipedriveConnection = `FAILED - ${error.message}`;
    }

    // Test 3: Check webhook function exists
    const webhookUrl = `${new URL(req.url).origin}/api/functions/pipedriveWebhook`;
    
    // Test 4: Check required stage IDs
    const jobBookedStageId = Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID');
    const inProgressStageId = Deno.env.get('PIPEDRIVE_IN_PROGRESS_STAGE_ID');

    return Response.json({
      success: pipedriveConnection === 'SUCCESS',
      webhook_url: webhookUrl,
      tests: {
        api_token: apiToken ? 'SUCCESS - Token is set' : 'FAILED',
        pipedrive_connection: pipedriveConnection,
        deals_accessible: dealCount > 0 ? `SUCCESS - Found ${dealCount} deals` : 'No deals found',
        webhook_endpoint: 'SUCCESS - Endpoint available',
        job_booked_stage_id: jobBookedStageId || 'NOT SET - Add PIPEDRIVE_JOB_BOOKED_STAGE_ID to env',
        in_progress_stage_id: inProgressStageId || 'NOT SET (optional) - Add PIPEDRIVE_IN_PROGRESS_STAGE_ID to env'
      },
      next_steps: [
        'Go to Pipedrive Settings → Webhooks',
        'Click "Create a webhook"',
        `Set endpoint URL: ${webhookUrl}`,
        'Select event: "Updated Deal"',
        'Get your "Job Booked" stage ID from Pipedrive and add it to app secrets as PIPEDRIVE_JOB_BOOKED_STAGE_ID',
        'Test by moving a deal to "Job Booked" stage in Pipedrive'
      ]
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});