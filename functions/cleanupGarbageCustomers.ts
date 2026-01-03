import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { action, customer_ids } = await req.json();

    // Step 1: Mark "Unknown" customers as garbage
    if (action === 'mark_garbage') {
      const response = await base44.asServiceRole.entities.Customer.list();
      const allCustomers = Array.isArray(response) ? response : (response?.data || []);
      const unknownCustomers = allCustomers.filter(c => 
        c.name === 'Unknown' && !c.deleted_at && !c.is_garbage_import
      );

      console.log(`Found ${unknownCustomers.length} "Unknown" customers to mark as garbage`);

      let marked = 0;
      for (const customer of unknownCustomers) {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          is_garbage_import: true,
          garbage_reason: 'Created from blank rows during import'
        });
        marked++;
      }

      return Response.json({
        success: true,
        action: 'mark_garbage',
        marked_count: marked,
        message: `Marked ${marked} "Unknown" customers as garbage`
      });
    }

    // Step 2: Analyze which garbage customers are safe to delete
    if (action === 'analyze') {
      const response = await base44.asServiceRole.entities.Customer.list();
      const allCustomers = Array.isArray(response) ? response : (response?.data || []);
      const garbageCustomers = allCustomers.filter(c => 
        c.is_garbage_import && !c.deleted_at
      );

      const jobsResponse = await base44.asServiceRole.entities.Job.list();
      const allJobs = Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse?.data || []);
      
      const projectsResponse = await base44.asServiceRole.entities.Project.list();
      const allProjects = Array.isArray(projectsResponse) ? projectsResponse : (projectsResponse?.data || []);

      const analysis = {
        safe_to_delete: [],
        has_jobs: [],
        has_projects: [],
        has_both: []
      };

      for (const customer of garbageCustomers) {
        const linkedJobs = allJobs.filter(j => j.customer_id === customer.id && !j.deleted_at);
        const linkedProjects = allProjects.filter(p => p.customer_id === customer.id && !p.deleted_at);
        
        const record = {
          id: customer.id,
          name: customer.name,
          jobs_count: linkedJobs.length,
          projects_count: linkedProjects.length,
          linked_jobs: linkedJobs.map(j => ({ id: j.id, job_number: j.job_number })),
          linked_projects: linkedProjects.map(p => ({ id: p.id, project_number: p.project_number }))
        };

        if (linkedJobs.length === 0 && linkedProjects.length === 0) {
          analysis.safe_to_delete.push(record);
        } else if (linkedJobs.length > 0 && linkedProjects.length === 0) {
          analysis.has_jobs.push(record);
        } else if (linkedProjects.length > 0 && linkedJobs.length === 0) {
          analysis.has_projects.push(record);
        } else {
          analysis.has_both.push(record);
        }
      }

      return Response.json({
        success: true,
        action: 'analyze',
        total_garbage: garbageCustomers.length,
        summary: {
          safe_to_delete_count: analysis.safe_to_delete.length,
          has_jobs_count: analysis.has_jobs.length,
          has_projects_count: analysis.has_projects.length,
          has_both_count: analysis.has_both.length
        },
        details: analysis
      });
    }

    // Step 3: Delete safe-to-delete garbage customers
    if (action === 'delete_safe') {
      const response = await base44.asServiceRole.entities.Customer.list();
      const allCustomers = Array.isArray(response) ? response : (response?.data || []);
      const garbageCustomers = allCustomers.filter(c => 
        c.is_garbage_import && !c.deleted_at
      );

      const jobsResponse = await base44.asServiceRole.entities.Job.list();
      const allJobs = Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse?.data || []);
      
      const projectsResponse = await base44.asServiceRole.entities.Project.list();
      const allProjects = Array.isArray(projectsResponse) ? projectsResponse : (projectsResponse?.data || []);

      const safeToDelete = [];
      for (const customer of garbageCustomers) {
        const hasJobs = allJobs.some(j => j.customer_id === customer.id && !j.deleted_at);
        const hasProjects = allProjects.some(p => p.customer_id === customer.id && !p.deleted_at);
        
        if (!hasJobs && !hasProjects) {
          safeToDelete.push(customer);
        }
      }

      console.log(`Deleting ${safeToDelete.length} safe-to-delete garbage customers`);

      const deletedAt = new Date().toISOString();
      let deleted = 0;

      for (const customer of safeToDelete) {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          deleted_at: deletedAt
        });
        deleted++;
      }

      return Response.json({
        success: true,
        action: 'delete_safe',
        deleted_count: deleted,
        message: `Deleted ${deleted} garbage customers with no linked records`
      });
    }

    // Step 4: Delete specific customer IDs (for manual cleanup of linked records)
    if (action === 'delete_specific' && customer_ids) {
      const deletedAt = new Date().toISOString();
      let deleted = 0;

      for (const id of customer_ids) {
        await base44.asServiceRole.entities.Customer.update(id, {
          deleted_at: deletedAt
        });
        deleted++;
      }

      return Response.json({
        success: true,
        action: 'delete_specific',
        deleted_count: deleted,
        message: `Deleted ${deleted} specific customer records`
      });
    }

    return Response.json({ error: 'Invalid action. Use: mark_garbage, analyze, delete_safe, or delete_specific' }, { status: 400 });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});