import { createClientFromRequest } from './shared/sdk.js';
import { updateProjectActivity } from './updateProjectActivity.js';
import { PO_STATUS, PART_STATUS, PART_LOCATION } from './shared/constants.js';
import { generateJobNumber } from './shared/jobNumberGenerator.js';
import { enforceJobUpdatePermission } from './shared/permissionHelpers.js';
import { applyJobUpdateGuardrails, logBlockedCompletionWrite } from './shared/jobUpdateGuardrails.js';

// Helper: Process sample transfers (explicit action on completion)
async function processSampleTransfers(base44, job) {
    if (!job.sample_ids || job.sample_ids.length === 0) return;
    
    // Skip if already processed (idempotency guard)
    if (job.samples_transfer_status === 'completed') {
        console.log(`[manageJob] Job ${job.id} samples already processed - skipping`);
        return;
    }

    try {
        // Invoke the dedicated sample transfer processor
        const result = await base44.asServiceRole.functions.invoke('processSampleTransfersForJob', {
            job_id: job.id
        });
        
        if (result?.data?.success) {
            console.log(`[manageJob] Processed ${result.data.processed_count} sample(s) for job ${job.id}`);
        } else {
            console.warn(`[manageJob] Sample transfer incomplete for job ${job.id}:`, result?.data?.skipped_reason);
        }
    } catch (error) {
        console.error(`[manageJob] Error processing sample transfers for job ${job.id}:`, error);
    }
}

// Helper: Create StockMovement records for completed logistics job
async function createStockMovementsForLogisticsJob(base44, job, user) {
    // IDEMPOTENCY: Abort if StockMovement already exists for this job
    const existingMovements = await base44.asServiceRole.entities.StockMovement.filter({
        job_id: job.id,
        source: 'logistics_job_completion'
    });
    if (existingMovements.length > 0) {
        console.log(`[StockMovement] Job ${job.id} already has movements - skipping`);
        return;
    }

    // VALIDATION: Require logistics_purpose
    if (!job.logistics_purpose) {
        console.error(`[StockMovement] Job ${job.id} missing logistics_purpose - aborting`);
        return;
    }

    // VALIDATION: Require origin OR destination
    if (!job.origin_address && !job.destination_address) {
        console.error(`[StockMovement] Job ${job.id} missing origin/destination - aborting`);
        return;
    }

    // Fetch parts linked to this logistics job
    const parts = await base44.asServiceRole.entities.Part.filter({
        purchase_order_id: job.purchase_order_id
    });

    if (parts.length === 0) {
        console.log(`[StockMovement] Job ${job.id} has no parts - skipping`);
        return;
    }

    // DETERMINISTIC RULES: Map logistics_purpose → from/to
    let fromLocationId = null, fromVehicleId = null, fromLocationName = null;
    let toLocationId = null, toVehicleId = null, toLocationName = null;

    // Fetch loading bay and storage locations
    const locations = await base44.asServiceRole.entities.InventoryLocation.list();
    const loadingBayLocation = locations.find(l => l.name === 'Loading Bay' || l.location_type === 'loading_bay');
    const storageLocation = locations.find(l => l.name === 'Warehouse Storage' || l.location_type === 'warehouse');

    switch (job.logistics_purpose) {
        case 'supplier_pickup':
            // Supplier → Vehicle
            toVehicleId = job.vehicle_id;
            if (!toVehicleId) {
                console.error(`[StockMovement] supplier_pickup requires vehicle_id`);
                return;
            }
            toLocationName = 'Vehicle';
            break;

        case 'po_delivery_to_loading_bay':
            // Supplier → Loading Bay
            toLocationId = loadingBayLocation?.id || null;
            toLocationName = 'Loading Bay';
            break;

        case 'move_to_storage':
            // Loading Bay → Storage
            fromLocationId = loadingBayLocation?.id || null;
            fromLocationName = 'Loading Bay';
            toLocationId = storageLocation?.id || null;
            toLocationName = 'Warehouse Storage';
            break;

        case 'material_pickup_for_install':
            // Storage → Vehicle
            fromLocationId = storageLocation?.id || null;
            fromLocationName = 'Warehouse Storage';
            toVehicleId = job.vehicle_id;
            if (!toVehicleId) {
                console.error(`[StockMovement] material_pickup_for_install requires vehicle_id`);
                return;
            }
            toLocationName = 'Vehicle';
            break;

        case 'sample_dropoff':
            // Storage → Client Site (external)
            fromLocationId = storageLocation?.id || null;
            fromLocationName = 'Warehouse Storage';
            toLocationName = 'Client Site';
            break;

        case 'sample_pickup':
            // Client Site → Storage
            fromLocationName = 'Client Site';
            toLocationId = storageLocation?.id || null;
            toLocationName = 'Warehouse Storage';
            break;

        default:
            console.error(`[StockMovement] Unknown logistics_purpose: ${job.logistics_purpose}`);
            return;
    }

    // Create StockMovement for each part
    for (const part of parts) {
        const quantity = part.quantity_required || 1;
        
        // VALIDATION: Quantity must be > 0
        if (quantity <= 0) {
            console.error(`[StockMovement] Invalid quantity for part ${part.id}`);
            continue;
        }

        await base44.asServiceRole.entities.StockMovement.create({
            job_id: job.id,
            project_id: job.project_id,
            purchase_order_id: job.purchase_order_id,
            part_id: part.id,
            sku_id: part.price_list_item_id,
            item_name: part.item_name || 'Unknown Item',
            quantity,
            from_location_id: fromLocationId,
            from_location_name: fromLocationName,
            from_vehicle_id: fromVehicleId,
            to_location_id: toLocationId,
            to_location_name: toLocationName,
            to_vehicle_id: toVehicleId,
            performed_by_user_id: user.id,
            performed_by_user_email: user.email,
            performed_by_user_name: user.full_name || user.display_name,
            performed_at: new Date().toISOString(),
            source: 'logistics_job_completion',
            notes: `Logistics job: ${job.logistics_purpose}`
        });
    }

    console.log(`[StockMovement] Created ${parts.length} movement(s) for job ${job.id}`);
}

// Helper: Deduct inventory for non-logistics job completion
async function processJobLineItemUsage(base44, job, user) {
    if (!job.id) return;
    
    // Fetch LineItems for this job
    const lineItems = await base44.asServiceRole.entities.LineItem.filter({
        job_id: job.id
    });
    
    if (lineItems.length === 0) {
        console.log(`[LineItemUsage] Job ${job.id} has no line items - skipping`);
        return;
    }
    
    // Check idempotency: abort if StockMovements already exist for this job
    const existingMovements = await base44.asServiceRole.entities.StockMovement.filter({
        job_id: job.id,
        source: 'job_completion_usage'
    });
    if (existingMovements.length > 0) {
        console.log(`[LineItemUsage] Job ${job.id} already has usage movements - skipping`);
        return;
    }
    
    try {
        // Get vehicle location if job has assigned technician
        let vehicleLocationId = null;
        let vehicleLocationName = 'Vehicle';
        
        if (job.assigned_to && job.assigned_to.length > 0) {
            const technician = await base44.asServiceRole.entities.User.filter({
                email: job.assigned_to[0]
            }).catch(() => null);
            
            if (technician && technician[0]) {
                // Assume technician has a vehicle in the InventoryLocation system
                // For now, we'll just create the movement without a specific location ID
                vehicleLocationName = `${job.assigned_to_name?.[0] || 'Technician'}'s Vehicle`;
            }
        }
        
        // Create StockMovement for each LineItem
        for (const item of lineItems) {
            const quantity = item.quantity || 1;
            
            if (quantity <= 0) {
                console.warn(`[LineItemUsage] Invalid quantity for item ${item.id}`);
                continue;
            }
            
            await base44.asServiceRole.entities.StockMovement.create({
                job_id: job.id,
                project_id: job.project_id,
                sku_id: item.price_list_item_id,
                item_name: item.item_name,
                quantity,
                movement_type: 'job_usage',
                from_location_name: vehicleLocationName,
                performed_by_user_id: user.id,
                performed_by_user_email: user.email,
                performed_by_user_name: user.full_name || user.display_name,
                performed_at: new Date().toISOString(),
                source: 'job_completion_usage',
                notes: `Used in job #${job.job_number} completion`
            });
        }
        
        console.log(`[LineItemUsage] Created ${lineItems.length} movement(s) for job ${job.id}`);
    } catch (error) {
        console.error(`[LineItemUsage] Error processing line items for job ${job.id}:`, error);
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
            // LOGISTICS JOB VALIDATION
            if (data?.is_logistics_job === true) {
                // Logistics jobs require logistics_purpose
                if (!data?.logistics_purpose) {
                    return Response.json({ error: 'Logistics purpose is required for logistics jobs' }, { status: 400 });
                }
                // Logistics jobs require origin OR destination address
                if (!data?.origin_address && !data?.destination_address) {
                    return Response.json({ error: 'Origin or destination address is required for logistics jobs' }, { status: 400 });
                }
            }

            // GUARDRAIL: Validate required fields for standard jobs
            if (data?.is_logistics_job !== true) {
                if (!data?.customer_id?.trim() && !data?.supplier_id) {
                    return Response.json({ error: 'Customer or Supplier is required' }, { status: 400 });
                }
            }
            if (!data?.scheduled_date) {
                return Response.json({ error: 'Scheduled date is required' }, { status: 400 });
            }

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
                
                // Inherit address fields if missing or empty
                if ((!jobData.address_full || jobData.address_full.trim() === '') && (project.address_full || project.address)) {
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

                // SCHEMA NORMALIZER: Convert project other_documents (objects) to job format (strings)
                if (project.other_documents && Array.isArray(project.other_documents)) {
                    jobData.other_documents = project.other_documents.map(doc => 
                        typeof doc === 'string' ? doc : doc.url
                    );
                }

                // SCHEMA NORMALIZER: Inherit image_urls but ensure it's array of strings
                if (project.image_urls && Array.isArray(project.image_urls) && !jobData.image_urls) {
                    jobData.image_urls = project.image_urls.map(img => 
                        typeof img === 'string' ? img : img.url || img
                    );
                }
            }

            // Auto-assign job number (skip for logistics jobs)
             if (!isLogisticsJob) {
                 jobData.job_number = await generateJobNumber(base44, jobData.project_id);
                 if (jobData.project_id) {
                     const project = await base44.asServiceRole.entities.Project.get(jobData.project_id);
                     jobData.project_number = project.project_number;
                 } else {
                     jobData.project_number = null;
                 }
             }

             // Set job_model_version for new jobs created after V2 cutoff date
             const V2_CUTOFF_DATE = new Date("2026-01-16T00:00:00Z");
             const now = new Date();
             if (now >= V2_CUTOFF_DATE && !jobData.job_model_version) {
                 jobData.job_model_version = "v2";
                 
                 // Strip legacy execution fields from V2 jobs - these should go in Visit records
                 const legacyExecutionFields = ['overview', 'next_steps', 'communication_with_client', 
                                                'completion_notes', 'pricing_provided', 'additional_info'];
                 legacyExecutionFields.forEach(field => {
                     if (jobData[field]) {
                         console.log(`[manageJob] Stripped legacy field '${field}' from new V2 job`);
                         delete jobData[field];
                     }
                 });
             }

             // GUARDRAIL: Enforce project-format jobs must have project_id
             const jobNumberStr = String(jobData.job_number || '');
             if (/^\d+-[A-Za-z]$/.test(jobNumberStr) && !jobData.project_id) {
                 return Response.json({ 
                     error: 'project_id required for project-format jobs',
                     code: 'JOB_PROJECT_LINK_REQUIRED'
                 }, { status: 400 });
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
                    console.warn("Customer not found - skipping contract link:", e.message);
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
              // GUARDRAIL: Verify job exists
              if (!id) {
                  return Response.json({ error: 'Job ID is required for update' }, { status: 400 });
              }

              previousJob = await base44.asServiceRole.entities.Job.get(id).catch(() => null);
              if (!previousJob) {
                  return Response.json({ error: 'Job not found' }, { status: 404 });
              }

              // PERMISSION CHECK: Technicians can only update assigned jobs
              enforceJobUpdatePermission(user, previousJob);

              // LOGISTICS JOB RULE: Logistics jobs do NOT require customer confirmation
              // Detect if this is a logistics job
              let isCurrentLogisticsJob = false;
              if (previousJob.job_type_id) {
                  try {
                      const jobType = await base44.asServiceRole.entities.JobType.get(previousJob.job_type_id);
                      isCurrentLogisticsJob = jobType?.is_logistics === true;
                  } catch (e) {}
              }
              isCurrentLogisticsJob = isCurrentLogisticsJob || previousJob.is_logistics_job === true || previousJob.purchase_order_id || previousJob.vehicle_id || previousJob.third_party_trade_id;

              // If this is a logistics job, force client_confirmed to true (skip requirement)
              if (isCurrentLogisticsJob && data.hasOwnProperty('client_confirmed') === false) {
                  data.client_confirmed = true;
              }

             // CRITICAL GUARDRAIL: Apply job update rules (draft vs final completion)
             // Only admins can write completion fields; technicians/regular users are in draft mode
             const updateMode = (user.role === 'admin' || user.role === 'manager') ? 'draft' : 'draft';
             const { cleanPatch, blockedFields, shouldLog } = applyJobUpdateGuardrails(previousJob, data, updateMode, user.email);

             if (shouldLog) {
                 logBlockedCompletionWrite(id, user.email, blockedFields, 'manageJob:update');
             }

             // Use the guardrail-filtered data for the update
             data = cleanPatch;

             // VISIT MODEL GUARDRAIL: If job has visits, legacy execution fields become read-only
             const visits = await base44.asServiceRole.entities.Visit.filter({ job_id: id });
             if (visits.length > 0) {
                 const legacyExecutionFields = ['work_performed', 'completion_notes', 'measurements', 'outcome', 'photos'];
                 const attemptedLegacyWrites = legacyExecutionFields.filter(field => data.hasOwnProperty(field));
                 
                 if (attemptedLegacyWrites.length > 0) {
                     console.warn(`[manageJob] Blocked legacy field writes for job ${id} (has ${visits.length} visit(s)): ${attemptedLegacyWrites.join(', ')}`);
                     
                     // Remove legacy fields from update
                     attemptedLegacyWrites.forEach(field => delete data[field]);
                 }
             }

             // GUARDRAIL: Detect if address is being explicitly overridden in this update
             const isAddressBeingOverridden = ['address_full', 'address_street', 'address_suburb', 'address_state', 'address_postcode', 'address_country', 'google_place_id', 'latitude', 'longitude']
               .some(f => data.hasOwnProperty(f));

             // PROJECT CONSISTENCY: If payload includes project_id, ensure it persists and pull cached fields if empty
             // BUT: Skip address sync if job.address_source === 'manual' (user has manually overridden it)
             if (data.hasOwnProperty('project_id') && data.project_id) {
               try {
                 const project = await base44.asServiceRole.entities.Project.get(data.project_id);

                 // Ensure project_id persists (never overwrite existing non-empty project_id)
                 if (previousJob.project_id && previousJob.project_id !== data.project_id) {
                   console.warn(`[manageJob:update] Skipping project_id change for job ${id}: existing=${previousJob.project_id}, new=${data.project_id}`);
                   data.project_id = previousJob.project_id;
                 }

                 // Pull project title/number only if job fields are empty
                 if (!previousJob.project_name && project.title) {
                   data.project_name = project.title;
                 }
                 if (!previousJob.project_number && project.project_number) {
                   data.project_number = project.project_number;
                 }

                 // CRITICAL: Only pull address from project if NOT manually overridden
                 const isManuallyOverridden = previousJob.address_source === 'manual';
                 if (!isManuallyOverridden && !previousJob.address_full && !isAddressBeingOverridden && (project.address_full || project.address)) {
                   data.address_full = project.address_full || project.address;
                   data.address_street = project.address_street;
                   data.address_suburb = project.address_suburb;
                   data.address_state = project.address_state;
                   data.address_postcode = project.address_postcode;
                   data.address_country = project.address_country || "Australia";
                   data.google_place_id = project.google_place_id;
                   data.latitude = project.latitude;
                   data.longitude = project.longitude;
                 }
               } catch (e) {
                 console.error(`[manageJob:update] Error pulling project data for project_id=${data.project_id}:`, e.message);
               }
             } else if (!data.hasOwnProperty('project_id') && previousJob.project_id) {
               // Preserve existing project_id on update if not explicitly being changed
               data.project_id = previousJob.project_id;
             }

             // Preserve address_source if already manual and no address fields are being updated
             if (previousJob.address_source === 'manual' && !isAddressBeingOverridden) {
               data.address_source = 'manual';
             }
            
            // GUARDRAIL: Prevent accidentally clearing critical fields
            if (data.hasOwnProperty('customer_id') && !data.customer_id) {
                return Response.json({ error: 'Customer cannot be removed from job' }, { status: 400 });
            }
            if (data.hasOwnProperty('scheduled_date') && !data.scheduled_date && previousJob.status === 'Scheduled') {
                return Response.json({ error: 'Cannot remove scheduled date from scheduled job' }, { status: 400 });
            }
            
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
            
            // Address provenance: track if user manually overrides address (only on explicit changes)
            let updateData = { ...data };

            if (isAddressBeingOverridden) {
              updateData.address_source = 'manual';
              updateData.address_overridden_at = new Date().toISOString();
              updateData.address_overridden_by = user.email;
            }

            // GUARDRAIL: Prevent logistics jobs from having customer_name/address manually overridden
            if (isLogisticsJob && (data.customer_name || data.address || data.address_full)) {
                // Strip out these fields to prevent manual override
                const { customer_name, address, address_full, ...safeData } = updateData;
                job = await base44.asServiceRole.entities.Job.update(id, safeData);
            } else {
                job = await base44.asServiceRole.entities.Job.update(id, updateData);
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
            
            // SILENT VISIT CREATION: If job just became Scheduled, ensure active Visit exists
            if (job.status === 'Scheduled' && previousJob.status !== 'Scheduled') {
                try {
                    await base44.asServiceRole.functions.invoke('ensureActiveVisit', { job_id: job.id });
                } catch (e) {
                    console.error("Failed to ensure active visit (non-critical):", e);
                }
            }

            // Update project activity when job is updated
            if (job.project_id) {
                await updateProjectActivity(base44, job.project_id, 'Job Updated');
            }

            // Handle job completion
            if (job.status === 'Completed' && previousJob.status !== 'Completed') {
                // LOGISTICS JOB: Record stock movements
                if (job.is_logistics_job === true) {
                    await handleLogisticsJobCompletion(base44, job);

                    // Create StockMovement records
                    if (job.logistics_purpose && job.purchase_order_id) {
                        await createStockMovementsForLogisticsJob(base44, job, user);
                    }
                } else {
                    // STANDARD JOB: Deduct inventory from LineItems
                    await processJobLineItemUsage(base44, job, user);
                }

                // Process sample transfers (explicit action on completion)
                if (job.sample_ids && job.sample_ids.length > 0) {
                    await processSampleTransfers(base44, job);
                }
            }

            // Removed legacy PO receiving logic - now handled via logistics_outcome
        } else if (action === 'reset_address_from_project') {
            // Reset address to project defaults
            if (!id) {
                return Response.json({ error: 'Job ID is required' }, { status: 400 });
            }

            const jobToReset = await base44.asServiceRole.entities.Job.get(id).catch(() => null);
            if (!jobToReset) {
                return Response.json({ error: 'Job not found' }, { status: 404 });
            }

            if (!jobToReset.project_id) {
                return Response.json({ error: 'Job is not linked to a project. Cannot reset address.' }, { status: 400 });
            }

            const project = await base44.asServiceRole.entities.Project.get(jobToReset.project_id).catch(() => null);
            if (!project || !project.address_full) {
                return Response.json({ error: 'Project has no address to restore from.' }, { status: 400 });
            }

            // Restore address from project
            job = await base44.asServiceRole.entities.Job.update(id, {
                address_full: project.address_full || project.address,
                address_street: project.address_street,
                address_suburb: project.address_suburb,
                address_state: project.address_state,
                address_postcode: project.address_postcode,
                address_country: project.address_country || 'Australia',
                google_place_id: project.google_place_id,
                latitude: project.latitude,
                longitude: project.longitude,
                address_source: 'project',
                address_overridden_at: null,
                address_overridden_by: null
            });

            return Response.json({ success: true, job });
        } else if (action === 'delete') {
            // GUARDRAIL: Verify job exists
            if (!id) {
                return Response.json({ error: 'Job ID is required for deletion' }, { status: 400 });
            }
            
            const jobToDelete = await base44.asServiceRole.entities.Job.get(id).catch(() => null);
            if (!jobToDelete) {
                return Response.json({ error: 'Job not found' }, { status: 404 });
            }
            
            // GUARDRAIL: Prevent deleting checked-in jobs
            const activeCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
                job_id: id
            });
            const unclosedCheckIns = activeCheckIns.filter(c => !c.check_out_time);
            
            if (unclosedCheckIns.length > 0) {
                return Response.json({ 
                    error: 'Cannot delete job with active check-in. Please check out first.',
                    active_check_ins: unclosedCheckIns.length
                }, { status: 400 });
            }
            
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

        // LINK VALIDATOR: Check if job has project-format number but missing project_id
        const warnings = [];
        if (job && !job.project_id) {
          const jobNumberStr = String(job.job_number || '');
          // Format: ####-X indicates project job
          if (/^\d{4}-[A-Z]$/.test(jobNumberStr)) {
            const warning = `Job #${job.job_number} has project-format number but project_id is null`;
            console.warn(`[manageJob] ${warning}`);
            warnings.push(warning);
          }
        }

        const response = { success: true, job };
        if (warnings.length > 0) {
          response.warnings = warnings;
        }

        return Response.json(response);
        } catch (error) {
         return Response.json({ error: error.message }, { status: 500 });
        }
        });