import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all customers and jobs
    const customers = await base44.asServiceRole.entities.Customer.filter({
      deleted_at: { $exists: false }
    });

    const jobs = await base44.asServiceRole.entities.Job.filter({
      deleted_at: { $exists: false }
    });

    // Create a set of customer IDs that have jobs
    const customerIdsWithJobs = new Set(jobs.map(job => job.customer_id).filter(Boolean));

    // Find customers without jobs
    const customersWithoutJobs = customers.filter(customer => !customerIdsWithJobs.has(customer.id));

    console.log(`Total customers: ${customers.length}`);
    console.log(`Customers with jobs: ${customerIdsWithJobs.size}`);
    console.log(`Customers without jobs: ${customersWithoutJobs.length}`);

    // Delete customers without jobs
    const deletedIds = [];
    for (const customer of customersWithoutJobs) {
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
      message: `Deleted ${deletedIds.length} customers without jobs`,
      stats: {
        total_customers: customers.length,
        customers_with_jobs: customerIdsWithJobs.size,
        customers_without_jobs: customersWithoutJobs.length,
        deleted: deletedIds.length
      }
    });

  } catch (error) {
    console.error('Delete customers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});