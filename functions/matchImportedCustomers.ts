import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all customers for matching
    const allCustomers = await base44.asServiceRole.entities.Customer.list();
    
    // Fetch all projects with unresolved customer names
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const unmatchedProjects = allProjects.filter(p => p.import_customer_name_raw && !p.customer_id);

    let matchedCount = 0;
    let notFoundCount = 0;
    const notFound = [];

    for (const project of unmatchedProjects) {
      const rawName = project.import_customer_name_raw.trim().toLowerCase();
      
      // Try to find matching customer by normalized name
      const match = allCustomers.find(c => 
        c.normalized_name === rawName || 
        c.name.toLowerCase().trim() === rawName
      );

      if (match) {
        // Update project with matched customer
        await base44.asServiceRole.entities.Project.update(project.id, {
          customer_id: match.id,
          customer_name: match.name,
          customer_phone: match.phone,
          customer_email: match.email
        });
        matchedCount++;
        console.log(`Matched project ${project.project_number} to customer: ${match.name}`);
      } else {
        notFoundCount++;
        notFound.push({
          project_number: project.project_number,
          raw_name: project.import_customer_name_raw
        });
        console.log(`No match found for: ${project.import_customer_name_raw}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      total_unmatched: unmatchedProjects.length,
      matched: matchedCount,
      not_found: notFoundCount,
      not_found_details: notFound.slice(0, 50) // First 50 for review
    });

  } catch (error) {
    console.error('Error matching customers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});