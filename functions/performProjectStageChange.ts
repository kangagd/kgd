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

        // 7. Load StageAutomationRules
        // We assume one rule per stage name
        const rules = await base44.asServiceRole.entities.StageAutomationRules.filter({ stage_name: new_stage });
        const rule = rules.length > 0 ? rules[0] : null;

        // 12. Allow backward movement check
        const oldIndex = STAGE_ORDER.indexOf(old_stage);
        const newIndex = STAGE_ORDER.indexOf(new_stage);
        
        // If stages are in the known list and we are moving backwards
        if (oldIndex !== -1 && newIndex !== -1 && newIndex < oldIndex) {
            // If rule exists and explicitly forbids backward movement
            if (rule && rule.allow_backward_movement === false) {
                 return Response.json({ error: `Backward movement to '${new_stage}' is not allowed by automation rules.` }, { status: 400 });
            }
        }

        // 9. Validate Required Fields
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

        // Automations
        if (rule) {
            // 8. Auto Create Job
            if (rule.auto_create_job && rule.job_type_id) {
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
                        address: project.address,
                        address_full: project.address_full,
                        // Copy other relevant fields
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
                // Example: Create a "Material Pickup" job if not exists
                // We need a JobType for this, assume we find one or create a generic logistics job
                // For this example, we'll look for a JobType named "Material Pickup" or similar
                
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
                        address: project.address,
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