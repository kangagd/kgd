import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all suppliers
    const suppliers = await base44.asServiceRole.entities.Supplier.list();
    
    if (suppliers.length === 0) {
      return Response.json({ message: 'No suppliers found', created: 0, updated: 0 });
    }

    let created = 0;
    let updated = 0;
    const errors = [];

    // For each supplier, create/update organisation and customer
    for (const supplier of suppliers) {
      try {
        // Step 1: Find or create Organisation with supplier name
        let organisation;
        const existingOrgs = await base44.asServiceRole.entities.Organisation.filter({
          name: supplier.name,
        });

        if (existingOrgs.length > 0) {
          organisation = existingOrgs[0];
        } else {
          // Create new organisation
          organisation = await base44.asServiceRole.entities.Organisation.create({
            name: supplier.name,
            organisation_type: 'Supplier',
            phone: supplier.phone,
            email: supplier.email,
          });
        }

        // Step 2: Create or update Customer
        // Use contact_name if available, otherwise use supplier name
        const customerName = supplier.contact_name || supplier.name;

        // Check if customer already exists (by name + supplier name organisation)
        const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
          name: customerName,
          organisation_id: organisation.id,
        });

        if (existingCustomers.length > 0) {
          // Update existing customer
          await base44.asServiceRole.entities.Customer.update(existingCustomers[0].id, {
            phone: supplier.phone || existingCustomers[0].phone,
            email: supplier.email || existingCustomers[0].email,
            organisation_id: organisation.id,
          });
          updated++;
        } else {
          // Create new customer
          await base44.asServiceRole.entities.Customer.create({
            name: customerName,
            phone: supplier.phone,
            email: supplier.email,
            organisation_id: organisation.id,
            customer_type: 'Other',
          });
          created++;
        }
      } catch (err) {
        errors.push({
          supplier: supplier.name,
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      message: `Migration complete: ${created} created, ${updated} updated`,
      created,
      updated,
      total: suppliers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Save suppliers as customers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});