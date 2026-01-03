import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all customers and filter for "Unknown" (case-sensitive)
    const response = await base44.asServiceRole.entities.Customer.list();
    const allCustomers = Array.isArray(response) ? response : (response?.data || []);
    const unknownCustomers = allCustomers.filter(c => c.name === 'Unknown' && !c.deleted_at);

    console.log(`Found ${unknownCustomers.length} customers with name "Unknown"`);

    if (unknownCustomers.length === 0) {
      return Response.json({
        success: true,
        message: 'No customers with name "Unknown" found',
        deleted: 0
      });
    }

    // Get all jobs and projects to check for links
    const jobsResponse = await base44.asServiceRole.entities.Job.list();
    const allJobs = Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse?.data || []);
    
    const projectsResponse = await base44.asServiceRole.entities.Project.list();
    const allProjects = Array.isArray(projectsResponse) ? projectsResponse : (projectsResponse?.data || []);

    // Filter to only delete customers without any links
    const customersToDelete = unknownCustomers.filter(customer => {
      const hasJobs = allJobs.some(j => j.customer_id === customer.id && !j.deleted_at);
      const hasProjects = allProjects.some(p => p.customer_id === customer.id && !p.deleted_at);
      return !hasJobs && !hasProjects;
    });

    const customersWithLinks = unknownCustomers.filter(customer => {
      const hasJobs = allJobs.some(j => j.customer_id === customer.id && !j.deleted_at);
      const hasProjects = allProjects.some(p => p.customer_id === customer.id && !p.deleted_at);
      return hasJobs || hasProjects;
    });

    console.log(`${customersToDelete.length} customers can be deleted (no links)`);
    console.log(`${customersWithLinks.length} customers have links (skipping)`);

    // Soft delete customers without links in batches
    const deletedAt = new Date().toISOString();
    const batchSize = 100;
    let deleted = 0;

    for (let i = 0; i < customersToDelete.length; i += batchSize) {
      const batch = customersToDelete.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(customer => 
          base44.asServiceRole.entities.Customer.update(customer.id, {
            deleted_at: deletedAt
          })
        )
      );
      
      deleted += batch.length;
      console.log(`Deleted ${deleted}/${customersToDelete.length} customers...`);
    }

    // Re-evaluate duplicates after deletion
    try {
      await base44.asServiceRole.functions.invoke('reevaluateDuplicatesAfterDeletion', {
        entity_type: 'Customer'
      });
      console.log('Successfully re-evaluated duplicates');
    } catch (error) {
      console.error('Error re-evaluating duplicates:', error);
    }

    return Response.json({
      success: true,
      message: `Deleted ${deleted} customer(s) with name "Unknown"`,
      deleted: deleted,
      skipped_with_links: customersWithLinks.length,
      total_unknown_found: unknownCustomers.length
    });

  } catch (error) {
    console.error('Error deleting unknown customers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});