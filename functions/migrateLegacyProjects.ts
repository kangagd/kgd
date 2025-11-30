import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
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

    const projects = await base44.asServiceRole.entities.Project.list();

    for (const project of projects) {
      results.processed++;
      let needsUpdate = false;
      const updates = {};

      // Migrate Pipedrive Deal ID
      if (project.pipedrive_deal_id && !project.legacy_pipedrive_deal_id) {
        updates.legacy_pipedrive_deal_id = String(project.pipedrive_deal_id);
        needsUpdate = true;
      }

      // Map Status/Stage if using old values
      // Example mapping from old Pipedrive stages to new Enums
      const statusMapping = {
        'Lead In': 'Lead',
        'Contact Made': 'Initial Site Visit',
        'Needs Defined': 'Initial Site Visit',
        'Proposal/Price Quote': 'Quote Sent',
        'Negotiations Started': 'Quote Sent',
        'Closed Won': 'Scheduled', // or Completed depending on other fields
        'Closed Lost': 'Lost'
      };

      if (statusMapping[project.status]) {
        updates.status = statusMapping[project.status];
        needsUpdate = true;
      }

      // Ensure Customer Name is cached if missing
      if (project.customer_id && !project.customer_name) {
         try {
            const customer = await base44.asServiceRole.entities.Customer.get(project.customer_id);
            if (customer) {
                updates.customer_name = customer.name;
                updates.customer_email = customer.email;
                updates.customer_phone = customer.phone;
                needsUpdate = true;
            }
         } catch (e) {
             // Customer might not exist
         }
      }

      if (needsUpdate) {
        if (!dryRun) {
          try {
            await base44.asServiceRole.entities.Project.update(project.id, updates);
            results.updated++;
          } catch (e) {
            results.errors.push({ id: project.id, error: e.message });
          }
        } else {
          results.updated++;
        }
      } else {
        results.skipped++;
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Project migration complete',
      dryRun,
      stats: results 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});