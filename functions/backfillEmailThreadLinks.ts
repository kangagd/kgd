import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all threads without customer/project links
    const allThreads = await base44.asServiceRole.entities.EmailThread.list();
    const threadsToProcess = allThreads.filter(t => !t.customer_id && !t.project_id && !t.is_deleted);
    
    console.log(`Processing ${threadsToProcess.length} threads for auto-linking...`);

    // Fetch all customers once for efficiency
    const customers = await base44.asServiceRole.entities.Customer.list();
    
    let linkedToCustomer = 0;
    let linkedToProject = 0;
    let noMatch = 0;

    for (const thread of threadsToProcess) {
      try {
        // Extract all email addresses from thread
        const allEmails = [
          thread.from_address?.toLowerCase(),
          ...(thread.to_addresses || []).map(e => e.toLowerCase())
        ].filter(Boolean);

        // Find matching customer
        const matchingCustomer = customers.find(c => 
          c.email && allEmails.includes(c.email.toLowerCase())
        );

        if (matchingCustomer) {
          // Find most recent open project for this customer
          const projects = await base44.asServiceRole.entities.Project.filter({
            customer_id: matchingCustomer.id
          });
          
          const openProjects = projects.filter(p => 
            !['Completed', 'Lost', 'Cancelled'].includes(p.status)
          ).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          
          const projectToLink = openProjects[0];
          
          if (projectToLink) {
            await base44.asServiceRole.entities.EmailThread.update(thread.id, {
              customer_id: matchingCustomer.id,
              customer_name: matchingCustomer.name,
              project_id: projectToLink.id,
              project_number: projectToLink.project_number,
              project_title: projectToLink.title,
              linked_to_project_at: new Date().toISOString(),
              linked_to_project_by: 'system_backfill'
            });
            linkedToProject++;
          } else {
            await base44.asServiceRole.entities.EmailThread.update(thread.id, {
              customer_id: matchingCustomer.id,
              customer_name: matchingCustomer.name
            });
            linkedToCustomer++;
          }
        } else {
          noMatch++;
        }
      } catch (err) {
        console.error(`Error processing thread ${thread.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      processed: threadsToProcess.length,
      linkedToProject,
      linkedToCustomer,
      noMatch
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});