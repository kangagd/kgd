import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { issueId } = await req.json();
        if (!issueId) {
            return Response.json({ error: "Issue ID required" }, { status: 400 });
        }

        const issue = await base44.entities.WarrantyIssue.get(issueId);
        if (!issue) {
            return Response.json({ error: "Issue not found" }, { status: 404 });
        }

        const project = await base44.entities.Project.get(issue.project_id);
        if (!project) {
            return Response.json({ error: "Project not found" }, { status: 404 });
        }
        
        const customer = await base44.entities.Customer.get(project.customer_id);

        // Create Warranty Job
        const jobData = {
            project_id: project.id,
            project_name: project.title,
            customer_id: project.customer_id,
            customer_name: project.customer_name,
            customer_email: customer?.email,
            customer_phone: customer?.phone,
            customer_type: customer?.customer_type,
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
            
            job_category: "Standard",
            is_warranty_job: true,
            linked_warranty_project_id: project.id,
            warranty_reason: issue.description,
            
            // Warranty jobs are free usually? Not specified but implies no charge.
            // The prompt says "No charges (0-priced by default)" - implementation detail for pricing logic, 
            // but for job creation, maybe just note it.
            
            description: `WARRANTY ISSUE: ${issue.description}\n\nReported by: ${issue.reported_by}\nResolution Notes: ${issue.resolution_notes || ''}`,
            notes: `Generated from Warranty Issue #${issueId}`,
            
            status: "Open",
            
            // Attempt to find a "Warranty" job type if exists, otherwise default/leave blank
            // Since we can't easily search for "Warranty" job type without knowing the ID or searching all,
            // we'll look it up.
        };

        // Try to find Warranty job type
        const jobTypes = await base44.entities.JobType.filter({});
        const warrantyType = jobTypes.find(jt => jt.name.toLowerCase().includes('warranty'));
        if (warrantyType) {
            jobData.job_type_id = warrantyType.id;
            jobData.job_type = warrantyType.name;
            jobData.job_type_name = warrantyType.name;
            jobData.expected_duration = warrantyType.estimated_duration || 60;
        } else {
            jobData.job_type = "Warranty"; // Fallback text
            jobData.expected_duration = 60;
        }

        const newJob = await base44.entities.Job.create(jobData);

        // Update Issue
        await base44.entities.WarrantyIssue.update(issueId, {
            status: "Approved",
            generated_warranty_job_id: newJob.id,
            resolved_at: new Date().toISOString(), // Or maybe resolved when job completes? Prompt says "Once approved -> warranty job appears". And "Completion of warranty job updates warranty issue status -> Closed".
            // Actually prompt says: "Once approved -> warranty job appears... Completion of warranty job updates warranty issue status -> Closed."
            // So status here should be "Approved" (which means job created), then later "Closed".
        });
        
        // Trigger recalc warranty to ensure consistent state
        await base44.functions.invoke('project_calculateWarranty', { projectId: project.id });

        return Response.json({ success: true, job: newJob });

    } catch (error) {
        console.error("Error in warranty_createJob:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});