import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Get the job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // If job already has address, don't sync (unless forced)
    if (job.address_full && job.address_full.trim()) {
      return Response.json({ 
        success: true, 
        message: 'Job already has address',
        synced: false
      });
    }

    // Get the project
    if (!job.project_id) {
      return Response.json({ 
        success: true, 
        message: 'Job has no linked project',
        synced: false
      });
    }

    const project = await base44.asServiceRole.entities.Project.get(job.project_id);
    
    if (!project) {
      return Response.json({ 
        success: true, 
        message: 'Project not found',
        synced: false
      });
    }

    // Skip logistics jobs
    const jobTypes = await base44.asServiceRole.entities.JobType.list();
    const logisticsJobTypeIds = jobTypes
      .filter(jt => jt.is_logistics === true)
      .map(jt => jt.id);

    if (logisticsJobTypeIds.includes(job.job_type_id)) {
      return Response.json({ 
        success: true, 
        message: 'Logistics jobs do not get synced',
        synced: false
      });
    }

    // Sync address from project
    await base44.asServiceRole.entities.Job.update(job.id, {
      address: project.address_full || project.address,
      address_full: project.address_full || project.address,
      address_street: project.address_street,
      address_suburb: project.address_suburb,
      address_state: project.address_state,
      address_postcode: project.address_postcode,
      address_country: project.address_country || "Australia",
      google_place_id: project.google_place_id,
      latitude: project.latitude,
      longitude: project.longitude
    });

    return Response.json({ 
      success: true, 
      message: 'Job address synced from project',
      synced: true
    });
  } catch (error) {
    console.error('Error syncing job address:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});