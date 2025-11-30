import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { primary_id, duplicate_id } = await req.json();

    if (!primary_id || !duplicate_id) {
      return Response.json({ error: 'Both primary_id and duplicate_id are required' }, { status: 400 });
    }

    if (primary_id === duplicate_id) {
        return Response.json({ error: 'Cannot merge a customer into itself' }, { status: 400 });
    }

    // 1. Get both customers
    const primaryCustomer = await base44.asServiceRole.entities.Customer.get(primary_id);
    const duplicateCustomer = await base44.asServiceRole.entities.Customer.get(duplicate_id);

    if (!primaryCustomer || !duplicateCustomer) {
        return Response.json({ error: 'Customers not found' }, { status: 404 });
    }

    // 2. Move Jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({ customer_id: duplicate_id });
    await Promise.all(jobs.map(job => 
      base44.asServiceRole.entities.Job.update(job.id, { 
        customer_id: primary_id, 
        customer_name: primaryCustomer.name 
      })
    ));

    // 3. Move Projects
    const projects = await base44.asServiceRole.entities.Project.filter({ customer_id: duplicate_id });
    await Promise.all(projects.map(project => 
      base44.asServiceRole.entities.Project.update(project.id, { 
        customer_id: primary_id, 
        customer_name: primaryCustomer.name 
      })
    ));

    // 4. Move Quotes
    const quotes = await base44.asServiceRole.entities.Quote.filter({ customer_id: duplicate_id });
    await Promise.all(quotes.map(quote => 
      base44.asServiceRole.entities.Quote.update(quote.id, { 
        customer_id: primary_id, 
        customer_name: primaryCustomer.name 
      })
    ));

    // 5. Move/Update Email Threads if applicable (if linked to customer directly)
    // Assuming EmailThread isn't directly linked to customer_id but maybe via project/job. 
    // If there are direct customer links, we should update them.
    // Checking EmailThread entity... it doesn't seem to have customer_id. 
    // But other entities like Invoice might.
    const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ customer_id: duplicate_id });
    await Promise.all(invoices.map(inv => 
        base44.asServiceRole.entities.XeroInvoice.update(inv.id, { 
            customer_id: primary_id,
            customer_name: primaryCustomer.name
        })
    ));


    // 6. Archive duplicate customer
    await base44.asServiceRole.entities.Customer.update(duplicate_id, {
      status: 'merged',
      merge_status: 'merged',
      duplicate_of_id: primary_id,
      deleted_at: new Date().toISOString(),
      notes: (duplicateCustomer.notes ? duplicateCustomer.notes + '\n\n' : '') + `[MERGED] Merged into ${primaryCustomer.name} (${primary_id}) on ${new Date().toLocaleDateString()}`
    });
    
    // 7. Update primary customer notes if needed
    await base44.asServiceRole.entities.Customer.update(primary_id, {
        notes: (primaryCustomer.notes ? primaryCustomer.notes + '\n\n' : '') + `[MERGE] Merged data from ${duplicateCustomer.name} (${duplicate_id}) on ${new Date().toLocaleDateString()}`
    });

    return Response.json({ success: true, primary_id, duplicate_id });

  } catch (error) {
    console.error('Merge error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});