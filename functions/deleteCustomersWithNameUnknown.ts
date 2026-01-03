import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all customers with name "unknown" (case-insensitive)
    const allCustomers = await base44.asServiceRole.entities.Customer.filter({
      deleted_at: { $exists: false }
    });

    const unknownCustomers = allCustomers.filter(c => 
      c.name && c.name.toLowerCase().trim() === 'unknown'
    );

    if (unknownCustomers.length === 0) {
      return Response.json({
        success: true,
        message: 'No customers with name "unknown" found',
        deleted: 0
      });
    }

    // Soft delete all unknown customers
    const deletedAt = new Date().toISOString();
    for (const customer of unknownCustomers) {
      await base44.asServiceRole.entities.Customer.update(customer.id, {
        deleted_at: deletedAt
      });
    }

    // Re-evaluate duplicates after deletion
    try {
      await base44.asServiceRole.functions.invoke('reevaluateDuplicatesAfterDeletion', {
        entity_type: 'Customer'
      });
    } catch (error) {
      console.error('Error re-evaluating duplicates:', error);
    }

    return Response.json({
      success: true,
      message: `Deleted ${unknownCustomers.length} customer(s) with name "unknown"`,
      deleted: unknownCustomers.length,
      customer_ids: unknownCustomers.map(c => c.id)
    });

  } catch (error) {
    console.error('Error deleting unknown customers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});