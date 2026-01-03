import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalization helpers
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[\s\+\(\)\-\.]/g, '');
}

function normalizeAddress(record) {
  const parts = [
    record.address_street,
    record.address_suburb,
    record.address_state,
    record.address_postcode,
    record.address_full,
    record.address
  ].filter(Boolean);
  
  return normalizeString(parts.join(' '));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const results = {
      customers: { total: 0, updated: 0, skipped: 0 },
      organisations: { total: 0, updated: 0, skipped: 0 }
    };

    // Backfill Customers
    console.log('Starting customer backfill...');
    const customers = await base44.asServiceRole.entities.Customer.filter({
      deleted_at: { $exists: false }
    });
    
    results.customers.total = customers.length;

    for (const customer of customers) {
      const normalizedName = normalizeString(customer.name);
      const normalizedEmail = customer.email ? customer.email.toLowerCase().trim() : null;
      const normalizedPhone = normalizePhone(customer.phone);
      const normalizedAddress = normalizeAddress(customer);

      // Check if update is needed
      const needsUpdate = 
        customer.normalized_name !== normalizedName ||
        customer.normalized_email !== normalizedEmail ||
        customer.normalized_phone !== normalizedPhone ||
        customer.normalized_address !== normalizedAddress;

      if (needsUpdate) {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          normalized_name: normalizedName,
          normalized_email: normalizedEmail,
          normalized_phone: normalizedPhone,
          normalized_address: normalizedAddress
        });
        results.customers.updated++;
        console.log(`Updated customer: ${customer.name} (${customer.id})`);
      } else {
        results.customers.skipped++;
      }
    }

    // Backfill Organisations
    console.log('Starting organisation backfill...');
    const organisations = await base44.asServiceRole.entities.Organisation.filter({
      deleted_at: { $exists: false }
    });
    
    results.organisations.total = organisations.length;

    for (const org of organisations) {
      const normalizedName = normalizeString(org.name);
      const normalizedEmail = org.email ? org.email.toLowerCase().trim() : null;
      const normalizedPhone = normalizePhone(org.phone);

      // Check if update is needed
      const needsUpdate = 
        org.normalized_name !== normalizedName ||
        org.normalized_email !== normalizedEmail ||
        org.normalized_phone !== normalizedPhone;

      if (needsUpdate) {
        await base44.asServiceRole.entities.Organisation.update(org.id, {
          normalized_name: normalizedName,
          normalized_email: normalizedEmail,
          normalized_phone: normalizedPhone
        });
        results.organisations.updated++;
        console.log(`Updated organisation: ${org.name} (${org.id})`);
      } else {
        results.organisations.skipped++;
      }
    }

    return Response.json({
      success: true,
      message: 'Backfill completed successfully',
      results
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});