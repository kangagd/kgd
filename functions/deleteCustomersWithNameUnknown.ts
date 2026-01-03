import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Use filter() instead of list() to get customers with name "unknown"
    const response = await base44.asServiceRole.entities.Customer.filter(
      { name: 'Unknown' }
    );
    const unknownCustomers = Array.isArray(response) ? response : (response?.data || []);

    console.log(`Found ${unknownCustomers.length} customers with name "Unknown"`);

    if (unknownCustomers.length === 0) {
      return Response.json({
        success: true,
        message: 'No customers with name "Unknown" found',
        deleted: 0
      });
    }

    // Soft delete all unknown customers in batches
    const deletedAt = new Date().toISOString();
    const batchSize = 50;
    let deleted = 0;

    for (let i = 0; i < unknownCustomers.length; i += batchSize) {
      const batch = unknownCustomers.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}, batch type: ${typeof batch}, isArray: ${Array.isArray(batch)}`);
      
      await Promise.all(
        batch.map(customer => 
          base44.asServiceRole.entities.Customer.update(customer.id, {
            deleted_at: deletedAt
          })
        )
      );
      
      deleted += batch.length;
      console.log(`Deleted ${deleted}/${unknownCustomers.length} customers...`);
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
      message: `Deleted ${unknownCustomers.length} customer(s) with name "Unknown"`,
      deleted: unknownCustomers.length
    });

  } catch (error) {
    console.error('Error deleting unknown customers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});