import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action } = await req.json().catch(() => ({}));

    // Fetch all customers
    const customers = await base44.asServiceRole.entities.Customer.list();

    let deletedNoContact = 0;
    let deletedSoftDeleted = 0;
    let updatedCount = 0;

    // Action 1: Delete soft-deleted customers
    if (!action || action === 'delete_soft_deleted') {
      for (const customer of customers) {
        if (customer.deleted_at) {
          await base44.asServiceRole.entities.Customer.delete(customer.id);
          deletedSoftDeleted++;
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit protection
        }
      }
    }

    // Action 2: Delete customers with no contact info
    if (!action || action === 'delete_no_contact') {
      for (const customer of customers) {
        if (!customer.deleted_at && !customer.email && !customer.phone) {
          await base44.asServiceRole.entities.Customer.delete(customer.id);
          deletedNoContact++;
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit protection
        }
      }
    }

    // Action 3: Normalize all fields
    if (!action || action === 'normalize') {
      for (const customer of customers) {
        if (customer.deleted_at || (!customer.email && !customer.phone)) continue;

        const updates = {};
        let needsUpdate = false;

        // Always recalculate normalized fields
        if (customer.name) {
          const normalized = customer.name.toLowerCase().trim();
          if (customer.normalized_name !== normalized) {
            updates.normalized_name = normalized;
            needsUpdate = true;
          }
        }

        if (customer.email) {
          const normalized = customer.email.toLowerCase().trim();
          if (customer.normalized_email !== normalized) {
            updates.normalized_email = normalized;
            needsUpdate = true;
          }
        }

        if (customer.phone) {
          const normalized = customer.phone.replace(/\D/g, '');
          if (customer.normalized_phone !== normalized) {
            updates.normalized_phone = normalized;
            needsUpdate = true;
          }
        }

        // Fix and normalize address - exclude country-only addresses
        const addressParts = [
          customer.address_street,
          customer.address_suburb,
          customer.address_state,
          customer.address_postcode
        ].filter(Boolean);
        
        // Only create normalized address if we have meaningful address data (not just country)
        const normalizedAddress = addressParts.length > 0 
          ? addressParts.join(', ').toLowerCase() 
          : '';

        if (customer.normalized_address !== normalizedAddress && normalizedAddress !== '') {
          updates.normalized_address = normalizedAddress;
          needsUpdate = true;
        }

        // Update address_full only if we have real address parts (not just country)
        if (addressParts.length > 0) {
          const fullAddress = addressParts.join(', ');
          if (customer.address_full !== fullAddress) {
            updates.address_full = fullAddress;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await base44.asServiceRole.entities.Customer.update(customer.id, updates);
          updatedCount++;
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit protection
        }
      }
    }

    return Response.json({
      success: true,
      deletedSoftDeleted,
      deletedNoContact,
      updatedCount,
      message: `Deleted ${deletedSoftDeleted} soft-deleted, ${deletedNoContact} with no contact, updated ${updatedCount} customers`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});