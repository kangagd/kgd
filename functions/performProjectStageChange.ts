import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STAGE_ORDER = [
    "Lead",
    "Initial Site Visit",
    "Create Quote",
    "Quote Sent",
    "Quote Approved",
    "Final Measure",
    "Parts Ordered",
    "Scheduled",
    "Completed",
    "Warranty",
    "Lost"
];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // 1. Authenticate & Validate Permissions
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const allowedRoles = ['admin', 'manager'];
        if (!allowedRoles.includes(user.role)) {
            return Response.json({ error: 'Permission denied. Only admins and managers can change project stages.' }, { status: 403 });
        }

        const { project_id, new_stage, notes } = await req.json();

        if (!project_id || !new_stage) {
            return Response.json({ error: 'Missing required fields: project_id, new_stage' }, { status: 400 });
        }

        // 3. Fetch Project
        const project = await base44.asServiceRole.entities.Project.get(project_id);
        if (!project) {
            return Response.json({ error: 'Project not found' }, { status: 404 });
        }

        const old_stage = project.status;
        
        // No change needed
        if (old_stage === new_stage) {
            return Response.json({ success: true, project, message: 'Stage already set' });
        }

        // 7. Load StageAutomationRules for NEW stage
        const rules = await base44.asServiceRole.entities.StageAutomationRules.filter({ stage_name: new_stage });
        const rule = rules.length > 0 ? rules[0] : null;

        // 12. Check backward movement
        const oldIndex = STAGE_ORDER.indexOf(old_stage);
        const newIndex = STAGE_ORDER.indexOf(new_stage);
        const isBackward = oldIndex !== -1 && newIndex !== -1 && newIndex < oldIndex;
        
        // If moving backwards
        if (isBackward) {
            // Check if target stage allows backward movement
            if (rule && rule.allow_backward_movement === false) {
                 return Response.json({ error: `Backward movement to '${new_stage}' is not allowed by automation rules.` }, { status: 400 });
            }

            // Handle automation jobs from OLD stage (the one we are leaving)
            // Find jobs created by the old stage's automation rule and put them on hold
            const oldStageRules = await base44.asServiceRole.entities.StageAutomationRules.filter({ stage_name: old_stage });
            const oldRule = oldStageRules.length > 0 ? oldStageRules[0] : null;

            if (oldRule && oldRule.auto_create_job && oldRule.job_type_id) {
                // Find open jobs of this type for this project
                // We do this manually since filter might not support complex queries easily
                const potentialJobs = await base44.asServiceRole.entities.Job.filter({
                    project_id: project_id,
                    job_type_id: oldRule.job_type_id
                });

                for (const job of potentialJobs) {
                    if (job.status === 'Open' || job.status === 'Scheduled') {
                        await base44.asServiceRole.entities.Job.update(job.id, { 
                            status: 'On Hold', 
                            notes: (job.notes || '') + `\n[System ${new Date().toISOString().split('T')[0]}] Placed On Hold due to stage regression from ${old_stage} to ${new_stage}.`
                        });
                    }
                }
            }
            
            // Note: We explicitly do NOT delete parts or logistics jobs as per requirement
        }

        // 9. Validate Required Fields (only for forward movement or generally?)
        // Usually required fields are for *entering* a stage. We check it regardless of direction unless specified otherwise.
        if (rule && rule.auto_require_fields && rule.auto_require_fields.length > 0) {
            const missingFields = [];
            for (const field of rule.auto_require_fields) {
                if (!project[field] || (Array.isArray(project[field]) && project[field].length === 0)) {
                    missingFields.push(field);
                }
            }
            
            if (missingFields.length > 0) {
                return Response.json({ 
                    error: `Cannot move to stage '${new_stage}'. Missing required fields: ${missingFields.join(', ')}` 
                }, { status: 400 });
            }
        }

        // 4 & 5. Update Project
        const updateData = {
            status: new_stage,
            previous_stage: old_stage,
            stage_changed_at: new Date().toISOString(),
            stage_notes: notes || null
        };

        const updatedProject = await base44.asServiceRole.entities.Project.update(project_id, updateData);

        // 6. Create History Record
        await base44.asServiceRole.entities.ProjectStageHistory.create({
            project_id: project_id,
            old_stage: old_stage,
            new_stage: new_stage,
            changed_by: user.email,
            changed_at: new Date().toISOString(),
            automatic: false,
            notes: notes || ''
        });

        let autoCreatedJobs = [];

        // Automations - Only run creation automations if NOT moving backward?
        // Usually if you move backward, you don't want to re-trigger "forward" automations of the earlier stage 
        // (e.g. re-create Initial Site Visit job when moving back to it).
        // The requirement says: "When moving backward: ... Mark created automation jobs as 'on hold' instead of cancelling."
        // It implies we handle the "cleanup" of the old stage.
        // Does it imply we should run the "new stage" automations?
        // If I move back to "Initial Site Visit" (which has auto_create_job=true), should I create a NEW job?
        // Likely NOT, or check if one exists. 
        // Common sense: Don't auto-create if moving backward, unless specifically desired. 
        // But the prompt didn't explicitly say "Don't create jobs for the new stage".
        // However, "Mark created automation jobs as 'on hold' instead of cancelling" refers to the OLD stage's jobs.
        // Let's assume for safety we DON'T run creation automations on backward movement to avoid duplicates, 
        // unless the user deleted the old ones.
        // But if I move back to "Initial Site Visit", I probably want to do another visit.
        // Let's look at the rule: "2. Initial Site Visit - auto_create_job: true".
        // If I move back to it, I probably want a job.
        // BUT, if I already have one (even completed), maybe I don't want another?
        // Let's stick to: Run automations defined for the *new* stage (target), because that's what "entering a stage" implies.
        // If the user moves back, they might want to re-do the step.
        
        // HOWEVER, the prompt says: "Mark created automation jobs as 'on hold' instead of cancelling." 
        // This refers to the *abandoned* stage's jobs.
        // So:
        // 1. Handle old stage jobs (hold them).
        // 2. Handle new stage jobs (create them if rule says so).
        
        // 8. Create Job from Stage (New Logic)
        const createdJob = await createJobFromProjectStage(base44, updatedProject, new_stage, user);
        if (createdJob) {
            autoCreatedJobs.push(createdJob);
        }

        if (rule) {
            // Legacy Auto Create Job (Only if new logic didn't trigger, to avoid duplicates)
            if (!createdJob && rule.auto_create_job && rule.job_type_id) {
                // Check if we should create it. 
                // If moving backward, maybe we shouldn't? 
                // The user didn't say "Don't create jobs when moving backward".
                // So we will proceed with creation logic.
                
                // Fetch job type to get details if needed
                const jobType = await base44.asServiceRole.entities.JobType.get(rule.job_type_id);
                
                if (jobType) {
                    const newJob = await base44.asServiceRole.entities.Job.create({
                        project_id: project_id,
                        customer_id: project.customer_id,
                        organisation_id: project.organisation_id,
                        status: "Open",
                        job_type_id: rule.job_type_id,
                        job_type: jobType.name, // De-normalized
                        job_category: jobType.category,
                        title: `${jobType.name} for ${project.title}`,
                        customer_name: project.customer_name,
                        customer_phone: project.customer_phone,
                        customer_email: project.customer_email,
                        product: project.project_type, // Map project_type to job product as best fit
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
                        created_by: user.email
                    });
                    autoCreatedJobs.push(newJob);
                }
            }

            // 10. Auto Trigger Part Actions
            if (rule.auto_trigger_part_actions) {
                // Example: If moving to "Parts Ordered", set pending parts to "Ordered"
                if (new_stage === "Parts Ordered") {
                    const parts = await base44.asServiceRole.entities.Part.filter({ 
                        project_id: project_id, 
                        status: "Pending" 
                    });
                    
                    for (const part of parts) {
                        await base44.asServiceRole.entities.Part.update(part.id, { 
                            status: "Ordered",
                            order_date: new Date().toISOString().split('T')[0]
                        });
                    }
                }
            }

            // 11. Auto Trigger Logistics
            if (rule.auto_trigger_logistics) {
                // Only trigger if we haven't done it already? 
                // Or just create new ones?
                // We'll create new ones as per standard logic.
                
                const logisticsJobTypes = await base44.asServiceRole.entities.JobType.filter({ category: "Logistics" });
                // Prefer "Material Pickup" if available
                const pickupType = logisticsJobTypes.find(jt => jt.name.includes("Pickup")) || logisticsJobTypes[0];

                if (pickupType) {
                     const logisticsJob = await base44.asServiceRole.entities.Job.create({
                        project_id: project_id,
                        customer_id: project.customer_id,
                        organisation_id: project.organisation_id,
                        status: "Open",
                        job_type_id: pickupType.id,
                        job_type: pickupType.name,
                        job_category: "Logistics",
                        logistics_type: "Material Pickup – Warehouse", // Default
                        title: `Logistics: ${pickupType.name}`,
                        customer_name: project.customer_name,
                        customer_phone: project.customer_phone,
                        customer_email: project.customer_email,
                        product: project.project_type, // Map project_type to job product as best fit
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
                        created_by: user.email
                    });
                    autoCreatedJobs.push(logisticsJob);
                }
            }
        }

        return Response.json({
            success: true,
            project: updatedProject,
            auto_created_jobs: autoCreatedJobs
        });

    } catch (error) {
        console.error("Error in performProjectStageChange:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

const STAGE_JOB_TYPE_MAP = {
    "Initial Site Visit": "Initial Site Visit",
    "Final Measure": "Final Measure",
    "Scheduled": "Installation",
    "Maintenance": "Maintenance"
};

async function createJobFromProjectStage(base44, project, newStage, user) {
    const jobTypeName = STAGE_JOB_TYPE_MAP[newStage];
    if (!jobTypeName) return null;

    // Check for existing open/scheduled job
    // We need to fetch all jobs for project and filter in memory if filter() doesn't support job_type name directly or if it's safer
    // Job entity has 'job_type' field which stores the name (denormalized)
    const existingJobs = await base44.asServiceRole.entities.Job.filter({
        project_id: project.id,
        job_type: jobTypeName
    });
    
    const activeJob = existingJobs.find(j => ['Open', 'Scheduled'].includes(j.status));
    if (activeJob) return activeJob;

    // Load JobType
    const jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
    const jobType = jobTypes[0];

    if (!jobType) {
        console.warn(`JobType '${jobTypeName}' not found for stage '${newStage}'`);
        return null;
    }

    // Ensure Customer Details (Fallback)
    let customerName = project.customer_name;
    let customerPhone = project.customer_phone;
    let customerEmail = project.customer_email;

    if (!customerName && project.customer_id) {
        try {
            const customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
            if (customer) {
                customerName = customer.name;
                customerPhone = customer.phone;
                customerEmail = customer.email;
            }
        } catch (e) {
            console.error("Failed to fetch customer details fallback", e);
        }
    }

    // Build Address
    const addressFull = project.address_full || project.address || project.site_address || "";

    // Generate Job Number
    const lastJobs = await base44.asServiceRole.entities.Job.list('-job_number', 1);
    const nextJobNumber = (lastJobs?.[0]?.job_number || 4999) + 1;

    // Create Job
    const jobData = {
        job_number: nextJobNumber,
        project_id: project.id,
        customer_id: project.customer_id,
        customer_name: customerName || "Unknown Customer",
        customer_phone: customerPhone,
        customer_email: customerEmail,
        organisation_id: project.organisation_id,
        address: addressFull,
        address_full: addressFull,
        job_type_id: jobType.id,
        job_type: jobType.name,
        job_type_name: jobType.name,
        job_category: jobType.category,
        title: jobType.name,
        status: "Open",
        created_by: user.email,
        // Full Context Copy
        address_street: project.address_street,
        address_suburb: project.address_suburb,
        address_state: project.address_state,
        address_postcode: project.address_postcode,
        address_country: project.address_country,
        google_place_id: project.google_place_id,
        latitude: project.latitude,
        longitude: project.longitude,
        product: project.project_type,
        // Storing source/stage info in additional_info/notes as requested (without schema change)
        additional_info: JSON.stringify({
            source: "project_stage_change",
            stage_at_creation: newStage
        }),
        notes: (project.notes ? project.notes + "\n\n" : "") + `[System] Auto-created from stage change: ${newStage}`
    };

    return await base44.asServiceRole.entities.Job.create(jobData);
}