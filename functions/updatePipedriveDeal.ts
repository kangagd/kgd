import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { job_id, status } = await req.json();
    
    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }
    
    // Fetch job details
    const job = await base44.entities.Job.filter({ id: job_id });
    if (!job || job.length === 0) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const jobData = job[0];
    
    if (!jobData.pipedrive_deal_id) {
      return Response.json({ 
        success: false, 
        message: 'No Pipedrive deal linked to this job' 
      });
    }
    
    const dealId = jobData.pipedrive_deal_id;
    const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    
    // Map job status to Pipedrive status
    let pipedriveStatus = null;
    let pipedriveStageId = null;
    
    if (status === 'completed') {
      pipedriveStatus = 'won';
    } else if (status === 'cancelled') {
      pipedriveStatus = 'lost';
    } else if (status === 'in_progress') {
      // Get the "In Progress" stage ID from environment
      pipedriveStageId = parseInt(Deno.env.get('PIPEDRIVE_IN_PROGRESS_STAGE_ID') || '0');
    }
    
    const updateData = {};
    if (pipedriveStatus) {
      updateData.status = pipedriveStatus;
    }
    if (pipedriveStageId) {
      updateData.stage_id = pipedriveStageId;
    }
    
    // Update the deal in Pipedrive
    const response = await fetch(
      `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      }
    );
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to update Pipedrive deal');
    }
    
    return Response.json({ 
      success: true, 
      message: 'Pipedrive deal updated successfully',
      pipedrive_response: result.data
    });
    
  } catch (error) {
    console.error('Error updating Pipedrive deal:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});