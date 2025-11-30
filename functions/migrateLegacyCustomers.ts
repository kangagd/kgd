import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only admin can run migration
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dryRun = false } = await req.json();
    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    const customers = await base44.asServiceRole.entities.Customer.list();

    for (const customer of customers) {
      results.processed++;
      let needsUpdate = false;
      const updates = {};

      // Map Pipedrive ID if exists in 'extra' fields or mixed in schema
      // Assuming source data might be in fields like 'pipedrive_id' or 'old_id' if they existed
      // But since we only just added legacy_*, we look for data that might have been imported previously
      // Or we simply ensure the legacy fields are populated if they are empty but we have other indicators
      
      // Example: If customer has a 'pipedrive_id' field in the object (even if not in schema)
      if (customer.pipedrive_id && !customer.legacy_pipedrive_person_id) {
        updates.legacy_pipedrive_person_id = String(customer.pipedrive_id);
        needsUpdate = true;
      }

      // Clean up name if needed (normalization)
      if (customer.name && customer.name !== customer.name.trim()) {
        updates.name = customer.name.trim();
        needsUpdate = true;
      }

      if (needsUpdate) {
        if (!dryRun) {
          try {
            await base44.asServiceRole.entities.Customer.update(customer.id, updates);
            results.updated++;
          } catch (e) {
            results.errors.push({ id: customer.id, error: e.message });
          }
        } else {
          results.updated++; // Count as would-be updated
        }
      } else {
        results.skipped++;
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Customer migration complete',
      dryRun,
      stats: results 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});