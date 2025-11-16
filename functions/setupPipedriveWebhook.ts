import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    const jobBookedStageId = Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID');
    
    if (!apiToken) {
      return Response.json({ 
        error: 'PIPEDRIVE_API_TOKEN not set in environment variables' 
      }, { status: 400 });
    }

    // Get webhook URL
    const webhookUrl = `${new URL(req.url).origin}/api/functions/pipedriveWebhook`;

    // Test 1: Check Pipedrive connection
    const testResponse = await fetch(
      `https://api.pipedrive.com/v1/deals?limit=1&api_token=${apiToken}`
    );
    const testResult = await testResponse.json();
    
    if (!testResult.success) {
      return Response.json({
        success: false,
        error: 'Failed to connect to Pipedrive API',
        details: testResult.error
      }, { status: 400 });
    }

    // Test 2: Get stages to help user find the right stage ID
    const stagesResponse = await fetch(
      `https://api.pipedrive.com/v1/stages?api_token=${apiToken}`
    );
    const stagesData = await stagesResponse.json();

    // Test 3: Check if webhook already exists
    const webhooksResponse = await fetch(
      `https://api.pipedrive.com/v1/webhooks?api_token=${apiToken}`
    );
    const webhooksData = await webhooksResponse.json();
    
    const existingWebhook = webhooksData.data?.find(
      wh => wh.subscription_url === webhookUrl
    );

    return Response.json({
      success: true,
      webhook_url: webhookUrl,
      pipedrive_connected: true,
      configuration: {
        job_booked_stage_id: jobBookedStageId || 'NOT SET - Add PIPEDRIVE_JOB_BOOKED_STAGE_ID to environment variables',
        webhook_exists: !!existingWebhook,
        webhook_id: existingWebhook?.id || null
      },
      available_stages: stagesData.data?.map(stage => ({
        id: stage.id,
        name: stage.name,
        pipeline: stage.pipeline_name,
        is_configured: stage.id === parseInt(jobBookedStageId || '0')
      })) || [],
      instructions: [
        '1. Find your "Job Booked" stage ID from the available_stages list above',
        '2. Add PIPEDRIVE_JOB_BOOKED_STAGE_ID to your app secrets with that stage ID',
        '3. Go to Pipedrive Settings → Webhooks',
        '4. Click "Create a webhook"',
        `5. Set endpoint URL: ${webhookUrl}`,
        '6. Select event: "Deal" with action "Changed"',
        '7. Set HTTP method: POST',
        '8. Save the webhook',
        '9. Test by moving a deal to "Job Booked" stage in Pipedrive'
      ]
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});