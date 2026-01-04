import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all customers
    const customers = await base44.asServiceRole.entities.Customer.list();

    let deletedCount = 0;
    let updatedCount = 0;
    const deletedIds = [];

    for (const customer of customers) {
      // 1. Delete customers with no email AND no phone
      if (!customer.email && !customer.phone) {
        await base44.asServiceRole.entities.Customer.delete(customer.id);
        deletedIds.push(customer.id);
        deletedCount++;
        continue;
      }

      // 2. Build normalized fields and fix incomplete data
      const updates = {};
      let needsUpdate = false;

      // Normalize name
      if (customer.name && !customer.normalized_name) {
        updates.normalized_name = customer.name.toLowerCase().trim();
        needsUpdate = true;
      }

      // Normalize email
      if (customer.email && !customer.normalized_email) {
        updates.normalized_email = customer.email.toLowerCase().trim();
        needsUpdate = true;
      }

      // Normalize phone (remove all non-digits)
      if (customer.phone && !customer.normalized_phone) {
        updates.normalized_phone = customer.phone.replace(/\D/g, '');
        needsUpdate = true;
      }

      // Normalize address
      if (!customer.normalized_address) {
        const addressParts = [
          customer.address_full,
          customer.address_street,
          customer.address_suburb,
          customer.address_state,
          customer.address_postcode,
          customer.address_country
        ].filter(Boolean);
        
        if (addressParts.length > 0) {
          updates.normalized_address = addressParts.join(', ').toLowerCase();
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await base44.asServiceRole.entities.Customer.update(customer.id, updates);
        updatedCount++;
      }
    }

    return Response.json({
      success: true,
      deletedCount,
      updatedCount,
      deletedIds: deletedIds.slice(0, 10), // Show first 10 for reference
      message: `Deleted ${deletedCount} customers with no contact info, updated ${updatedCount} customers with normalized fields`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});