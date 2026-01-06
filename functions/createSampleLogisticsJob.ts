import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Sample Job Types
const SAMPLE_JOB_TYPES = {
  SAMPLE_DROP_OFF: "Sample Drop-Off",
  SAMPLE_PICKUP: "Sample Pickup",
};

// Logistics Purpose
const LOGISTICS_PURPOSE = {
  SAMPLE_DROPOFF: "sample_dropoff",
  SAMPLE_PICKUP: "sample_pickup",
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

    // Determine logistics purpose and addresses
    const warehouseAddress = "866 Bourke Street, Waterloo";
    const clientAddress = project.address_full || project.address || "Client Site";
    const logisticsPurpose = job_type === SAMPLE_JOB_TYPES.SAMPLE_DROP_OFF 
      ? LOGISTICS_PURPOSE.SAMPLE_DROPOFF 
      : LOGISTICS_PURPOSE.SAMPLE_PICKUP;
    const originAddress = job_type === SAMPLE_JOB_TYPES.SAMPLE_DROP_OFF 
      ? warehouseAddress 
      : clientAddress;
    const destinationAddress = job_type === SAMPLE_JOB_TYPES.SAMPLE_DROP_OFF 
      ? clientAddress 
      : warehouseAddress;

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
      is_logistics_job: true,
      logistics_purpose: logisticsPurpose,
      origin_address: originAddress,
      destination_address: destinationAddress,
    });

    // Record sample movement based on job type using manageSample
    if (job_type === SAMPLE_JOB_TYPES.SAMPLE_DROP_OFF) {
      // Drop-off: Check out samples to project immediately
      for (const sample_id of sample_ids) {
        try {
          await base44.functions.invoke('manageSample', {
            action: 'checkoutToProject',
            sample_id,
            project_id,
            notes: `Checked out for drop-off job #${job.job_number}`,
          });
        } catch (error) {
          console.error(`Error checking out sample ${sample_id}:`, error);
        }
      }
    }
    // For pickup, samples are moved on job completion

    return Response.json({
      success: true,
      job,
      updatedSamples: samples,
    });
  } catch (error) {
    console.error("Error creating sample logistics job:", error);
    return Response.json({ 
      success: false, 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
});