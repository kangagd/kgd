import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Merge duplicate customers - keeps one and merges all references
 * 
 * Flow:
 * 1. Validate both customers exist
 * 2. Get all projects, jobs, and other entities linked to the duplicate
 * 3. Re-link all entities to the primary customer
 * 4. Optionally merge customer data (take non-empty fields from duplicate)
 * 5. Soft-delete the duplicate customer
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { primary_customer_id, duplicate_customer_id, merge_data = true } = await req.json();

    if (!primary_customer_id || !duplicate_customer_id) {
      return Response.json({ 
        error: 'Both primary_customer_id and duplicate_customer_id are required' 
      }, { status: 400 });
    }

    if (primary_customer_id === duplicate_customer_id) {
      return Response.json({ 
        error: 'Cannot merge a customer with itself' 
      }, { status: 400 });
    }

    // Fetch both customers
    const [primaryCustomer, duplicateCustomer] = await Promise.all([
      base44.asServiceRole.entities.Customer.get(primary_customer_id),
      base44.asServiceRole.entities.Customer.get(duplicate_customer_id)
    ]);

    if (!primaryCustomer || !duplicateCustomer) {
      return Response.json({ error: 'One or both customers not found' }, { status: 404 });
    }

    console.log(`[mergeCustomers] Merging ${duplicateCustomer.name} into ${primaryCustomer.name}`);

    const stats = {
      projects_updated: 0,
      jobs_updated: 0,
      contracts_updated: 0,
      quotes_updated: 0,
      tasks_updated: 0
    };

    // 1. Update all projects
    const projects = await base44.asServiceRole.entities.Project.filter({ 
      customer_id: duplicate_customer_id 
    });
    
    for (const project of projects) {
      await base44.asServiceRole.entities.Project.update(project.id, {
        customer_id: primary_customer_id,
        customer_name: primaryCustomer.name,
        customer_phone: primaryCustomer.phone || project.customer_phone,
        customer_email: primaryCustomer.email || project.customer_email
      });
      stats.projects_updated++;
    }

    // 2. Update all jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({ 
      customer_id: duplicate_customer_id 
    });
    
    for (const job of jobs) {
      await base44.asServiceRole.entities.Job.update(job.id, {
        customer_id: primary_customer_id,
        customer_name: primaryCustomer.name,
        customer_phone: primaryCustomer.phone || job.customer_phone,
        customer_email: primaryCustomer.email || job.customer_email
      });
      stats.jobs_updated++;
    }

    // 3. Update contracts (if customer is contract owner)
    try {
      const contracts = await base44.asServiceRole.entities.Contract.filter({
        customer_id: duplicate_customer_id
      });
      
      for (const contract of contracts) {
        await base44.asServiceRole.entities.Contract.update(contract.id, {
          customer_id: primary_customer_id
        });
        stats.contracts_updated++;
      }
    } catch (e) {
      console.error('[mergeCustomers] Error updating contracts:', e);
    }

    // 4. Update quotes
    try {
      const quotes = await base44.asServiceRole.entities.Quote.filter({
        customer_id: duplicate_customer_id
      });
      
      for (const quote of quotes) {
        await base44.asServiceRole.entities.Quote.update(quote.id, {
          customer_id: primary_customer_id,
          customer_name: primaryCustomer.name
        });
        stats.quotes_updated++;
      }
    } catch (e) {
      console.error('[mergeCustomers] Error updating quotes:', e);
    }

    // 5. Update tasks
    try {
      const tasks = await base44.asServiceRole.entities.Task.filter({
        customer_id: duplicate_customer_id
      });
      
      for (const task of tasks) {
        await base44.asServiceRole.entities.Task.update(task.id, {
          customer_id: primary_customer_id,
          customer_name: primaryCustomer.name
        });
        stats.tasks_updated++;
      }
    } catch (e) {
      console.error('[mergeCustomers] Error updating tasks:', e);
    }

    // 6. Optionally merge data (take non-empty fields from duplicate)
    if (merge_data) {
      const mergedData = {};
      
      // Only merge if primary is missing data
      if (!primaryCustomer.phone && duplicateCustomer.phone) {
        mergedData.phone = duplicateCustomer.phone;
      }
      if (!primaryCustomer.email && duplicateCustomer.email) {
        mergedData.email = duplicateCustomer.email;
      }
      if (!primaryCustomer.address_full && duplicateCustomer.address_full) {
        mergedData.address_full = duplicateCustomer.address_full;
        mergedData.address_street = duplicateCustomer.address_street;
        mergedData.address_suburb = duplicateCustomer.address_suburb;
        mergedData.address_state = duplicateCustomer.address_state;
        mergedData.address_postcode = duplicateCustomer.address_postcode;
        mergedData.address_country = duplicateCustomer.address_country;
        mergedData.google_place_id = duplicateCustomer.google_place_id;
        mergedData.latitude = duplicateCustomer.latitude;
        mergedData.longitude = duplicateCustomer.longitude;
      }
      if (!primaryCustomer.notes && duplicateCustomer.notes) {
        mergedData.notes = duplicateCustomer.notes;
      }

      if (Object.keys(mergedData).length > 0) {
        await base44.asServiceRole.entities.Customer.update(primary_customer_id, mergedData);
      }
    }

    // 7. Soft delete the duplicate customer
    await base44.asServiceRole.entities.Customer.update(duplicate_customer_id, {
      deleted_at: new Date().toISOString(),
      notes: `${duplicateCustomer.notes || ''}\n\n[MERGED INTO: ${primaryCustomer.name} (${primary_customer_id}) on ${new Date().toISOString()}]`.trim()
    });

    return Response.json({
      success: true,
      message: `Successfully merged ${duplicateCustomer.name} into ${primaryCustomer.name}`,
      primary_customer: {
        id: primaryCustomer.id,
        name: primaryCustomer.name
      },
      duplicate_customer: {
        id: duplicateCustomer.id,
        name: duplicateCustomer.name
      },
      stats
    });

  } catch (error) {
    console.error('[mergeCustomers] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});