import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { moveSampleToClient, moveSampleFromClientToVehicle } from './recordSampleMovement.js';

// Sample Job Types
const SAMPLE_JOB_TYPES = {
  SAMPLE_DROP_OFF: "Sample Drop-Off",
  SAMPLE_PICKUP: "Sample Pickup",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const {
      project_id,
      vehicle_id,
      sample_ids,
      job_type,
      scheduled_date,
      notes,
    } = await req.json();

    // Validate required fields
    if (!project_id) {
      return Response.json({ 
        success: false, 
        error: "project_id is required" 
      }, { status: 400 });
    }

    if (!sample_ids || !Array.isArray(sample_ids) || sample_ids.length === 0) {
      return Response.json({ 
        success: false, 
        error: "sample_ids is required and must be a non-empty array" 
      }, { status: 400 });
    }

    if (!job_type || !Object.values(SAMPLE_JOB_TYPES).includes(job_type)) {
      return Response.json({ 
        success: false, 
        error: `job_type must be one of: ${Object.values(SAMPLE_JOB_TYPES).join(', ')}` 
      }, { status: 400 });
    }

    // Fetch project to get address and customer details
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    if (!project) {
      return Response.json({ 
        success: false, 
        error: "Project not found" 
      }, { status: 404 });
    }

    // Fetch samples to build notes
    const samples = [];
    for (const sample_id of sample_ids) {
      try {
        const sample = await base44.asServiceRole.entities.Sample.get(sample_id);
        if (sample) {
          samples.push(sample);
        }
      } catch (error) {
        console.error(`Error fetching sample ${sample_id}:`, error);
      }
    }

    const sampleNames = samples.map(s => s.name).join(', ');
    const jobNotes = notes 
      ? `${notes}\n\nSamples: ${sampleNames}` 
      : `Samples: ${sampleNames}`;

    // Find or create JobType
    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: job_type });
    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;

    if (!jobTypeId) {
      const newJobType = await base44.asServiceRole.entities.JobType.create({
        name: job_type,
        description: `Logistics: ${job_type}`,
        color: job_type === SAMPLE_JOB_TYPES.SAMPLE_DROP_OFF ? "#8B5CF6" : "#06B6D4",
        estimated_duration: 0.5,
        is_active: true
      });
      jobTypeId = newJobType.id;
    }

    // Create Job
    const job = await base44.asServiceRole.entities.Job.create({
      project_id,
      project_name: project.title,
      project_number: project.project_number,
      customer_id: project.customer_id,
      customer_name: project.customer_name,
      customer_phone: project.customer_phone,
      customer_email: project.customer_email,
      customer_type: project.customer_type,
      address: project.address,
      address_full: project.address_full,
      address_street: project.address_street,
      address_suburb: project.address_suburb,
      address_state: project.address_state,
      address_postcode: project.address_postcode,
      address_country: project.address_country,
      google_place_id: project.google_place_id,
      latitude: project.latitude,
      longitude: project.longitude,
      job_type: job_type,
      job_type_id: jobTypeId,
      job_type_name: job_type,
      vehicle_id: vehicle_id || null,
      sample_ids,
      status: scheduled_date ? "Scheduled" : "Open",
      scheduled_date: scheduled_date || null,
      notes: jobNotes,
      expected_duration: 0.5,
    });

    // Record sample movement based on job type
    let movementResult;
    
    if (job_type === SAMPLE_JOB_TYPES.SAMPLE_DROP_OFF) {
      // Drop-off: Move samples to client immediately
      movementResult = await moveSampleToClient(
        base44,
        sample_ids,
        project_id,
        user.email,
        job.id
      );
    } else if (job_type === SAMPLE_JOB_TYPES.SAMPLE_PICKUP) {
      // Pickup: Don't move yet - will be moved on job completion
      // Just mark intention via job creation
      // Movement will happen in performCheckOut or job completion handler
      movementResult = { 
        success: true, 
        message: "Pickup job created - samples will be moved on completion",
        updatedSamples: samples,
        movements: []
      };
    }

    if (!movementResult.success) {
      return Response.json({ 
        success: false, 
        error: `Job created but sample movement failed: ${movementResult.error}` 
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      job,
      updatedSamples: movementResult.updatedSamples || [],
      movements: movementResult.movements || []
    });
  } catch (error) {
    console.error("Error creating sample logistics job:", error);
    return Response.json({ 
      success: false, 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
});