import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Fetching all organisations and customers...');
    
    const [allOrganisations, allCustomers] = await Promise.all([
      base44.asServiceRole.entities.Organisation.list(),
      base44.asServiceRole.entities.Customer.list()
    ]);

    // Get set of organisation IDs that have customers
    const organisationsWithCustomers = new Set();
    for (const customer of allCustomers) {
      if (customer.organisation_id && !customer.deleted_at) {
        organisationsWithCustomers.add(customer.organisation_id);
      }
    }

    console.log(`Found ${organisationsWithCustomers.size} organisations with customers`);

    // Find organisations without customers
    const organisationsToDelete = allOrganisations.filter(org => 
      !org.deleted_at && !organisationsWithCustomers.has(org.id)
    );

    console.log(`Found ${organisationsToDelete.length} organisations without customers to delete`);

    // Delete them
    let deleted = 0;
    for (const org of organisationsToDelete) {
      try {
        await base44.asServiceRole.entities.Organisation.delete(org.id);
        deleted++;
        console.log(`Deleted: ${org.name} (${org.id})`);
      } catch (error) {
        console.error(`Failed to delete ${org.name}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      total_organisations: allOrganisations.length,
      organisations_with_customers: organisationsWithCustomers.size,
      organisations_deleted: deleted,
      deleted_names: organisationsToDelete.slice(0, 20).map(o => o.name)
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});