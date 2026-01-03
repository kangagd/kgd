import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all customers, jobs, and projects
    const customers = await base44.asServiceRole.entities.Customer.filter({
      deleted_at: { $exists: false }
    });

    const jobs = await base44.asServiceRole.entities.Job.filter({
      deleted_at: { $exists: false }
    });

    const projects = await base44.asServiceRole.entities.Project.filter({
      deleted_at: { $exists: false }
    });

    // Create a set of customer IDs that have jobs or projects
    const customerIdsWithJobs = new Set(jobs.map(job => job.customer_id).filter(Boolean));
    const customerIdsWithProjects = new Set(projects.map(project => project.customer_id).filter(Boolean));
    const customerIdsWithActivity = new Set([...customerIdsWithJobs, ...customerIdsWithProjects]);

    // Find customers without jobs or projects
    const customersWithoutActivity = customers.filter(customer => !customerIdsWithActivity.has(customer.id));

    console.log(`Total customers: ${customers.length}`);
    console.log(`Customers with jobs or projects: ${customerIdsWithActivity.size}`);
    console.log(`Customers without jobs or projects: ${customersWithoutActivity.length}`);

    // Delete customers without jobs or projects
    const deletedIds = [];
    for (const customer of customersWithoutActivity) {
      try {
        await base44.asServiceRole.entities.Customer.delete(customer.id);
        deletedIds.push(customer.id);
        console.log(`Deleted customer: ${customer.name} (${customer.id})`);
      } catch (error) {
        console.error(`Failed to delete customer ${customer.id}:`, error.message);
      }
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