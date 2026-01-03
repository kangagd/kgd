import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all customers, jobs, and projects
    const allCustomers = await base44.asServiceRole.entities.Customer.list();
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const allProjects = await base44.asServiceRole.entities.Project.list();

    // Filter out soft-deleted records
    const customers = allCustomers.filter(c => !c.deleted_at);
    const jobs = allJobs.filter(j => !j.deleted_at);
    const projects = allProjects.filter(p => !p.deleted_at);

    // Create a set of customer IDs that have jobs or projects
    const customerIdsWithJobs = new Set(jobs.map(job => job.customer_id).filter(Boolean));
    const customerIdsWithProjects = new Set(projects.map(project => project.customer_id).filter(Boolean));
    const customerIdsWithActivity = new Set([...customerIdsWithJobs, ...customerIdsWithProjects]);

    // Find customers without jobs or projects
    const customersWithoutActivity = customers.filter(customer => !customerIdsWithActivity.has(customer.id));

    console.log(`Total customers: ${customers.length}`);
    console.log(`Customers with jobs or projects: ${customerIdsWithActivity.size}`);
    console.log(`Customers without jobs or projects: ${customersWithoutActivity.length}`);

    // Delete customers without jobs or projects in batches
    const deletedIds = [];
    const batchSize = 10;
    
    for (let i = 0; i < customersWithoutActivity.length; i += batchSize) {
      const batch = customersWithoutActivity.slice(i, i + batchSize);
      const deletePromises = batch.map(customer => 
        base44.asServiceRole.entities.Customer.delete(customer.id)
          .then(() => {
            deletedIds.push(customer.id);
            return customer;
          })
          .catch(error => {
            console.error(`Failed to delete customer ${customer.id}:`, error.message);
            return null;
          })
      );
      
      const results = await Promise.all(deletePromises);
      const successfulDeletes = results.filter(r => r !== null);
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: Deleted ${successfulDeletes.length}/${batch.length} customers`);
    }

    return Response.json({
      success: true,
      message: `Deleted ${deletedIds.length} customers without jobs or projects`,
      stats: {
        total_customers: customers.length,
        customers_with_activity: customerIdsWithActivity.size,
        customers_without_activity: customersWithoutActivity.length,
        deleted: deletedIds.length
      }
    });

  } catch (error) {
    console.error('Delete customers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});