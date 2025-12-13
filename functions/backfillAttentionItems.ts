import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Auth check - admin only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = {
      projects_processed: 0,
      jobs_processed: 0,
      customers_processed: 0,
      total_items_created: 0,
      errors: []
    };

    // Fetch all active projects
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const activeProjects = allProjects.filter(p => 
      !p.deleted_at && 
      p.status !== 'Completed' && 
      p.status !== 'Lost' &&
      p.status !== 'Warranty'
    );

    // Fetch all active jobs
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const activeJobs = allJobs.filter(j => 
      !j.deleted_at && 
      j.status !== 'Completed' && 
      j.status !== 'Cancelled'
    );

    // Fetch all active customers
    const allCustomers = await base44.asServiceRole.entities.Customer.list();
    const activeCustomers = allCustomers.filter(c => 
      !c.deleted_at && 
      c.status === 'active'
    );

    // Process each project
    for (const project of activeProjects) {
      try {
        const response = await base44.asServiceRole.functions.invoke('generateAttentionItems', {
          entity_type: 'project',
          entity_id: project.id,
          mode: 'persist'
        });
        
        results.projects_processed++;
        if (response.data?.created_count) {
          results.total_items_created += response.data.created_count;
        }
      } catch (error) {
        results.errors.push({
          entity_type: 'project',
          entity_id: project.id,
          error: error.message
        });
      }
    }

    // Process each job
    for (const job of activeJobs) {
      try {
        const response = await base44.asServiceRole.functions.invoke('generateAttentionItems', {
          entity_type: 'job',
          entity_id: job.id,
          mode: 'persist'
        });
        
        results.jobs_processed++;
        if (response.data?.created_count) {
          results.total_items_created += response.data.created_count;
        }
      } catch (error) {
        results.errors.push({
          entity_type: 'job',
          entity_id: job.id,
          error: error.message
        });
      }
    }

    // Process each customer
    for (const customer of activeCustomers) {
      try {
        const response = await base44.asServiceRole.functions.invoke('generateAttentionItems', {
          entity_type: 'customer',
          entity_id: customer.id,
          mode: 'persist'
        });
        
        results.customers_processed++;
        if (response.data?.created_count) {
          results.total_items_created += response.data.created_count;
        }
      } catch (error) {
        results.errors.push({
          entity_type: 'customer',
          entity_id: customer.id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      summary: {
        projects_processed: results.projects_processed,
        jobs_processed: results.jobs_processed,
        customers_processed: results.customers_processed,
        total_items_created: results.total_items_created,
        error_count: results.errors.length
      },
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});