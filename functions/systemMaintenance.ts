import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only admin can run maintenance
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();
    const results = {
      migrated_jobs: 0,
      migrated_parts: 0,
      fixed_relationships: 0
    };

    if (action === 'migrate_legacy_data') {
      // 1. Backfill Logistics Flags on Jobs
      // Identify jobs that are essentially logistics but missing the flag
      const allJobs = await base44.asServiceRole.entities.Job.list();
      
      for (const job of allJobs) {
        let needsUpdate = false;
        const updates = {};

        // Check for logistics keywords in type or name
        const isLogistics = 
          (job.job_type_name || "").match(/(Delivery|Pickup|Return|Logistics)/i) ||
          (job.job_type || "").match(/(Delivery|Pickup|Return|Logistics)/i);

        if (isLogistics && !job.is_logistics_job) {
          updates.is_logistics_job = true;
          needsUpdate = true;
          results.migrated_jobs++;
        }

        // Fix missing project_name cache if project_id exists
        if (job.project_id && !job.project_name) {
          try {
            const project = await base44.asServiceRole.entities.Project.get(job.project_id);
            if (project) {
              updates.project_name = project.title;
              updates.customer_id = project.customer_id; // Ensure customer link
              needsUpdate = true;
              results.fixed_relationships++;
            }
          } catch (e) {
            console.warn(`Project ${job.project_id} not found for job ${job.id}`);
          }
        }

        if (needsUpdate) {
          await base44.asServiceRole.entities.Job.update(job.id, updates);
        }
      }

      // 2. Ensure Parts have correct status enums
      const allParts = await base44.asServiceRole.entities.Part.list();
      for (const part of allParts) {
        // Map legacy statuses if any (example)
        if (part.status === 'In Stock') {
          // 'In Stock' might map to 'Delivered' with location 'In Warehouse Storage'
          await base44.asServiceRole.entities.Part.update(part.id, {
            status: 'Delivered',
            location: 'In Warehouse Storage'
          });
          results.migrated_parts++;
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Maintenance complete',
      stats: results 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});