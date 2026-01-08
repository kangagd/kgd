import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await req.json();
    
    if (!jobId) {
      return Response.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Load the job to check access
    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check access: admin, manager, or assigned technician
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';
    const isAssigned = job.assigned_to && job.assigned_to.includes(user.email);

    if (!isAdmin && !isManager && !isAssigned) {
      return Response.json({ error: 'You do not have access to this job' }, { status: 403 });
    }

    // Fetch messages using service role
    const messages = await base44.asServiceRole.entities.JobMessage.filter({ 
      job_id: jobId 
    });

    return Response.json({ messages: messages || [] });

  } catch (error) {
    console.error('[getJobMessages] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});