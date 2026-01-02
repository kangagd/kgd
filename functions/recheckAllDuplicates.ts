import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const results = {
      customers_checked: 0,
      customers_with_duplicates: 0,
      projects_checked: 0,
      projects_with_duplicates: 0,
      jobs_checked: 0,
      jobs_with_duplicates: 0
    };

    // Recheck all Customers
    const allCustomers = await base44.asServiceRole.entities.Customer.list();
    const customers = allCustomers.filter(c => !c.deleted_at);

    for (const customer of customers) {
      try {
        const checkResult = await base44.functions.invoke('checkDuplicates', {
          entity_type: 'Customer',
          record: customer,
          exclude_id: customer.id,
          auto_update: true
        });
        
        results.customers_checked++;
        if (checkResult.data?.is_potential_duplicate) {
          results.customers_with_duplicates++;
        }
      } catch (error) {
        console.error(`Error checking customer ${customer.id}:`, error);
      }
    }

    // Recheck all Projects
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const projects = allProjects.filter(p => !p.deleted_at);

    for (const project of projects) {
      try {
        const checkResult = await base44.functions.invoke('checkDuplicates', {
          entity_type: 'Project',
          record: project,
          exclude_id: project.id,
          auto_update: true
        });
        
        results.projects_checked++;
        if (checkResult.data?.is_potential_duplicate) {
          results.projects_with_duplicates++;
        }
      } catch (error) {
        console.error(`Error checking project ${project.id}:`, error);
      }
    }

    // Recheck all Jobs
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const jobs = allJobs.filter(j => !j.deleted_at);

    for (const job of jobs) {
      try {
        const checkResult = await base44.functions.invoke('checkDuplicates', {
          entity_type: 'Job',
          record: job,
          exclude_id: job.id,
          auto_update: true
        });
        
        results.jobs_checked++;
        if (checkResult.data?.is_potential_duplicate) {
          results.jobs_with_duplicates++;
        }
      } catch (error) {
        console.error(`Error checking job ${job.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      message: 'All duplicate checks completed',
      ...results
    });

  } catch (error) {
    console.error('Recheck all duplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});