import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

// PO and Part status constants
const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

const PART_STATUS = {
  PENDING: "pending",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

const PART_LOCATION = {
  SUPPLIER: "supplier",
  LOADING_BAY: "loading_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

// Helper: Handle sample pickup job completion - move samples to vehicle
async function handleSamplePickupCompletion(base44, job) {
    if (!job.sample_ids || job.sample_ids.length === 0) return;
    
    const jobTypeName = (job.job_type_name || job.job_type || '').toLowerCase();
    const isSamplePickup = jobTypeName.includes('sample') && jobTypeName.includes('pickup');
    
    if (!isSamplePickup) return;

    try {
        // Import the helper function
        const { moveSampleFromClientToVehicle } = await import('./recordSampleMovement.js');
        
        // Move samples from client to vehicle (or warehouse if no vehicle)
        const vehicleId = job.vehicle_id || null;
        
        if (vehicleId) {
            await moveSampleFromClientToVehicle(
                base44,
                job.sample_ids,
                vehicleId,
                null, // technician_id will be set by recordSampleMovement context
                job.id
            );
        } else {
            // No vehicle - move to warehouse
            const { moveSampleToWarehouse } = await import('./recordSampleMovement.js');
            await moveSampleToWarehouse(base44, job.sample_ids, null);
        }
    } catch (error) {
        console.error(`Error handling sample pickup completion for job ${job.id}:`, error);
    }
}

// Helper: Handle logistics job completion - update PO and Parts based on outcome
async function handleLogisticsJobCompletion(base44, job) {
    if (!job.purchase_order_id) return;

    const logisticsOutcome = job.logistics_outcome;
    if (!logisticsOutcome || logisticsOutcome === 'none') return;

    try {
        // Fetch PO to check delivery method
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
        
        // Update PO status based on outcome
        let newPOStatus;
        let newPartStatus;
        let newPartLocation;

        if (po?.delivery_method === 'pickup' && logisticsOutcome === 'in_storage') {
            // For pickup orders, "in_storage" outcome means ready at supplier
            newPOStatus = PO_STATUS.AT_SUPPLIER;
            newPartStatus = PART_STATUS.AT_SUPPLIER;
            newPartLocation = PART_LOCATION.SUPPLIER;
        } else if (logisticsOutcome === 'in_storage') {
            // CRITICAL: Parts now physically at warehouse - AVAILABLE for picking
            newPOStatus = PO_STATUS.IN_STORAGE;
            newPartStatus = PART_STATUS.IN_STORAGE;
            newPartLocation = PART_LOCATION.WAREHOUSE_STORAGE;
        } else if (logisticsOutcome === 'in_vehicle') {
            // CRITICAL: Parts loaded in vehicle - AVAILABLE for installation
            newPOStatus = PO_STATUS.IN_VEHICLE;
            newPartStatus = PART_STATUS.IN_VEHICLE;
            newPartLocation = PART_LOCATION.VEHICLE;
        } else if (logisticsOutcome === 'in_loading_bay') {
            // Parts arrived but not put away - NOT YET AVAILABLE
            newPOStatus = PO_STATUS.IN_LOADING_BAY;
            newPartStatus = PART_STATUS.IN_LOADING_BAY;
            newPartLocation = PART_LOCATION.LOADING_BAY;
        }

        if (newPOStatus) {
            await base44.asServiceRole.entities.PurchaseOrder.update(job.purchase_order_id, {
                status: newPOStatus
            });
        }

        // Fetch Parts linked to this PO and update them to match physical reality
        const parts = await base44.asServiceRole.entities.Part.filter({
            purchase_order_id: job.purchase_order_id
        });

        for (const part of parts) {
            const updateData = {
                status: newPartStatus,
                location: newPartLocation
            };

            if (logisticsOutcome === 'in_vehicle' && job.vehicle_id) {
                updateData.assigned_vehicle_id = job.vehicle_id;
            }

            await base44.asServiceRole.entities.Part.update(part.id, updateData);
        }
    } catch (error) {
        console.error(`Error handling logistics job completion for job ${job.id}:`, error);
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, data } = await req.json();

        let job;
        let previousJob = null;

        if (action === 'create') {
            // Handle creation
            let jobData = { ...data };

            // Check if this is a logistics job
            const jobTypeName = (jobData.job_type_name || jobData.job_type || '').toLowerCase();
            const isLogisticsJob = /delivery|pickup|return|logistics/.test(jobTypeName);

            // Inherit address and customer fields from project if missing
            if (jobData.project_id) {
                const project = await base44.asServiceRole.entities.Project.get(jobData.project_id);
                
                // Inherit customer fields if missing
                if (!jobData.customer_id && project.customer_id) {
                    jobData.customer_id = project.customer_id;
                    jobData.customer_name = project.customer_name;
                    jobData.customer_phone = project.customer_phone;
                    jobData.customer_email = project.customer_email;
                    jobData.customer_type = project.customer_type;
                }
                
                // Inherit address fields if missing
                if (!jobData.address_full && (project.address_full || project.address)) {
                    jobData.address = project.address_full || project.address;
                    jobData.address_full = project.address_full || project.address;
                    jobData.address_street = project.address_street;
                    jobData.address_suburb = project.address_suburb;
                    jobData.address_state = project.address_state;
                    jobData.address_postcode = project.address_postcode;
                    jobData.address_country = project.address_country || "Australia";
                    jobData.google_place_id = project.google_place_id;
                    jobData.latitude = project.latitude;
                    jobData.longitude = project.longitude;
                }
            }

            // Auto-assign job number (skip for logistics jobs)
            if (!isLogisticsJob) {
                if (jobData.project_id) {
                    // Project job - use project number with alpha suffix
                    const project = await base44.asServiceRole.entities.Project.get(jobData.project_id);
                    const projectNumber = project.project_number;
                    
                    // Find existing jobs for this project to determine next suffix
                    const projectJobs = await base44.asServiceRole.entities.Job.filter({ 
                        project_id: jobData.project_id 
                    });
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    const suffix = alphabet[projectJobs.length] || `Z${projectJobs.length - 25}`;
                    
                    jobData.job_number = `${projectNumber}-${suffix}`;
                    jobData.project_number = projectNumber;
                } else {
                    // Standalone job - use unique number
                    const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 1);
                    const allProjects = await base44.asServiceRole.entities.Project.list('-project_number', 1);
                    
                    // Find highest number used across both projects and standalone jobs
                    let highestNumber = 4999;
                    
                    if (allProjects.length > 0 && allProjects[0].project_number) {
                        highestNumber = Math.max(highestNumber, allProjects[0].project_number);
                    }
                    
                    // Check existing standalone job numbers
                    const standaloneJobs = allJobs.filter(j => !j.project_id && typeof j.job_number === 'string' && !j.job_number.includes('-'));
                    for (const job of standaloneJobs) {
                        const num = parseInt(job.job_number);
                        if (!isNaN(num)) {
                            highestNumber = Math.max(highestNumber, num);
                        }
                    }
                    
                    jobData.job_number = String(highestNumber + 1);
                    jobData.project_number = null;
                }
            }

            // Check if this is "Initial Site Visit" job being created from a project at that stage
            if (jobData.project_id && !jobData.job_type_id) {
                try {
                    const project = await base44.asServiceRole.entities.Project.get(jobData.project_id);
                    if (project && project.status === 'Initial Site Visit') {
                        // Auto-set job type to "Initial Site Visit"
                        const jobTypes = await base44.asServiceRole.entities.JobType.filter({ 
                            name: 'Initial Site Visit' 
                        });
                        if (jobTypes.length > 0) {
                            jobData.job_type_id = jobTypes[0].id;
                            jobData.job_type = jobTypes[0].name;
                            jobData.job_type_name = jobTypes[0].name;
                        }
                    }
                } catch (e) {
                    console.error("Error auto-setting Initial Site Visit job type:", e);
                }
            }

            // Auto-link contract logic
            if (jobData.customer_id) {
                try {
                    const customer = await base44.asServiceRole.entities.Customer.get(jobData.customer_id);
                    if (customer && customer.contract_id) {
                        jobData.contract_id = customer.contract_id;
                        jobData.organisation_id = customer.organisation_id;
                        
                        jobData.is_contract_job = true;

                        // SLA Calculation
                        const contract = await base44.asServiceRole.entities.Contract.get(customer.contract_id);
                        if (contract && contract.sla_response_time_hours) {
                            const createdAt = new Date();
                            const slaDue = new Date(createdAt.getTime() + contract.sla_response_time_hours * 60 * 60 * 1000);
                            jobData.sla_due_at = slaDue.toISOString();
                        }
                    }
                } catch (e) {
                    console.error("Error auto-linking contract to job:", e);
                }
            }

            job = await base44.asServiceRole.entities.Job.create(jobData);
            
            // Create checklist items as Parts for logistics jobs
            if (isLogisticsJob && jobData.logistics_checklist_items && Array.isArray(jobData.logistics_checklist_items)) {
                for (const item of jobData.logistics_checklist_items) {
                    if (item.name) {
                        await base44.asServiceRole.entities.Part.create({
                            project_id: job.project_id || null,
                            item_name: item.name,
                            category: "Other",
                            quantity_required: item.quantity || 1,
                            status: PART_STATUS.PENDING,
                            location: PART_LOCATION.SUPPLIER,
                            linked_logistics_jobs: [job.id]
                        });
                    }
                }
            }
            
            // Update project activity when job is created
            if (job.project_id) {
                await updateProjectActivity(base44, job.project_id, 'Job Created');
            }
        } else if (action === 'update') {
            previousJob = await base44.asServiceRole.entities.Job.get(id);
            if (!previousJob) return Response.json({ error: 'Job not found' }, { status: 404 });
            
            // CRITICAL: Check JobType entity for is_logistics flag
            let previousJobTypeIsLogistics = false;
            let newJobTypeIsLogistics = false;
            
            if (previousJob.job_type_id) {
                try {
                    const prevJobType = await base44.asServiceRole.entities.JobType.get(previousJob.job_type_id);
                    previousJobTypeIsLogistics = prevJobType?.is_logistics === true;
                } catch (e) {}
            }
            
            if (data.job_type_id) {
                try {
                    const newJobType = await base44.asServiceRole.entities.JobType.get(data.job_type_id);
                    newJobTypeIsLogistics = newJobType?.is_logistics === true;
                } catch (e) {}
            }
            
            // Detect if job is becoming a logistics job
            const wasLogisticsJob = previousJobTypeIsLogistics ||
                                   previousJob.purchase_order_id || 
                                   previousJob.vehicle_id || 
                                   previousJob.third_party_trade_id;
            
            const isLogisticsJob = newJobTypeIsLogistics ||
                                  data.purchase_order_id || 
                                  data.vehicle_id || 
                                  data.third_party_trade_id ||
                                  wasLogisticsJob;
            
            // GUARDRAIL: Prevent logistics jobs from having customer_name/address manually overridden
            if (isLogisticsJob && (data.customer_name || data.address || data.address_full)) {
                // Strip out these fields to prevent manual override
                const { customer_name, address, address_full, ...safeData } = data;
                job = await base44.asServiceRole.entities.Job.update(id, safeData);
            } else {
                job = await base44.asServiceRole.entities.Job.update(id, data);
            }
            
            // CRITICAL: If job just became OR is already a logistics job, trigger title and address backfill
            // This ensures job_type_id changes immediately trigger the backfill
            if (isLogisticsJob) {
                try {
                    await base44.asServiceRole.functions.invoke('backfillLogisticsJobAddresses', {
                        job_ids: [job.id]
                    });
                    await base44.asServiceRole.functions.invoke('backfillLogisticsJobTitles', {
                        job_ids: [job.id]
                    });
                    // Re-fetch to get updated job
                    job = await base44.asServiceRole.entities.Job.get(id);
                } catch (error) {
                    console.error('Error backfilling logistics job data:', error);
                }
            }
            
            // Update project activity when job is updated
            if (job.project_id) {
                await updateProjectActivity(base44, job.project_id, 'Job Updated');
            }

            // Handle logistics job completion
            if (job.status === 'Completed' && previousJob.status !== 'Completed') {
                // Move Parts when PO logistics job is completed
                if (job.purchase_order_id) {
                    await handleLogisticsJobCompletion(base44, job);
                }
                
                // Move Samples when sample pickup job is completed
                if (job.sample_ids && job.sample_ids.length > 0) {
                    await handleSamplePickupCompletion(base44, job);
                }
            }

            // Removed legacy PO receiving logic - now handled via logistics_outcome
        } else if (action === 'delete') {
            // Get job before deletion to check for linked email thread
            const jobToDelete = await base44.asServiceRole.entities.Job.get(id);
            
            // Unlink from any email threads
            if (jobToDelete) {
                try {
                    // Find email threads linked to this job
                    const linkedThreads = await base44.asServiceRole.entities.EmailThread.filter({
                        linked_job_id: id
                    });
                    
                    // Unlink all threads
                    for (const thread of linkedThreads) {
                        await base44.asServiceRole.entities.EmailThread.update(thread.id, {
                            linked_job_id: null,
                            linked_job_number: null
                        });
                    }
                } catch (error) {
                    console.error('Error unlinking email threads from job:', error);
                }
            }
            
            // Soft delete the job
            await base44.asServiceRole.entities.Job.update(id, { deleted_at: new Date().toISOString() });
            return Response.json({ success: true });
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        // TRIGGER D: When an Installation job is scheduled → create “Material Pickup – Warehouse” job
        // Condition: Job type is Installation-like
        // And Status is Scheduled (and previously wasn't OR it's a new job)
        
        const isInstall = (job.job_type_name || "").toLowerCase().includes("install") || 
                          (job.job_type || "").toLowerCase().includes("install");
        
        let becameScheduled = false;
        if (action === 'create') {
            becameScheduled = (job.status === 'Scheduled' || !!job.scheduled_date);
        } else {
            becameScheduled = (job.status === 'Scheduled' && previousJob.status !== 'Scheduled') ||
                              (job.scheduled_date && !previousJob.scheduled_date);
        }

        if (isInstall && becameScheduled && job.project_id) {
            // Check parts in warehouse storage
            const parts = await base44.asServiceRole.entities.Part.filter({
                project_id: job.project_id,
                status: PART_STATUS.IN_STORAGE,
                location: PART_LOCATION.WAREHOUSE_STORAGE
            });

            if (parts.length > 0) {
                // Check if pickup job already exists
                const pickupJobTypeName = "Material Pickup – Warehouse";
                
                const existingPickup = await base44.asServiceRole.entities.Job.filter({
                    project_id: job.project_id,
                    job_type: pickupJobTypeName,
                    status: { $in: ['Open', 'Scheduled'] }
                });

                if (existingPickup.length === 0) {
                    // Create Pickup Job
                    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: pickupJobTypeName });
                    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                    
                    if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: pickupJobTypeName,
                             description: "Logistics: Pickup parts from warehouse",
                             color: "#f59e0b", // Amber
                             estimated_duration: 0.5,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                    }

                    // Calculate suggested time (e.g. 1 hour before install)
                    let scheduledDate = job.scheduled_date;
                    let scheduledTime = job.scheduled_time || "09:00";
                    // Simple logic: same date, 1 hour prior.
                    let pickupTime = "08:00";
                    try {
                        const [h, m] = scheduledTime.split(':').map(Number);
                        let ph = h - 1;
                        if (ph < 7) ph = 7;
                        pickupTime = `${ph.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    } catch (e) {}

                    // Fetch project for destination address
                    const project = await base44.asServiceRole.entities.Project.get(job.project_id);
                    const warehouseAddress = "866 Bourke Street, Waterloo";
                    const destinationAddress = project?.address_full || project?.address || "Client Site";

                    const pickupJob = await base44.asServiceRole.entities.Job.create({
                        job_type: pickupJobTypeName,
                        job_type_id: jobTypeId,
                        job_type_name: pickupJobTypeName,
                        project_id: job.project_id,
                        project_name: job.project_name,
                        customer_id: job.customer_id,
                        customer_name: job.customer_name,
                        customer_phone: job.customer_phone,
                        customer_email: job.customer_email,
                        customer_type: job.customer_type,
                        address: warehouseAddress,
                        address_full: warehouseAddress,
                        status: "Scheduled",
                        scheduled_date: scheduledDate,
                        scheduled_time: pickupTime,
                        expected_duration: 0.5,
                        notes: `Pickup for parts: ${parts.map(p => p.category).join(', ')}`,
                        is_logistics_job: true,
                        logistics_purpose: "part_pickup_for_install",
                        origin_address: warehouseAddress,
                        destination_address: destinationAddress,
                    });

                    // Link parts to this new job
                    for (const part of parts) {
                        const currentLinks = part.linked_logistics_jobs || [];
                        if (!currentLinks.includes(pickupJob.id)) {
                            await base44.asServiceRole.entities.Part.update(part.id, {
                                linked_logistics_jobs: [...currentLinks, pickupJob.id]
                            });
                        }
                    }
                }
            }
        }

        return Response.json({ success: true, job });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});