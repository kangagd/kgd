import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function processProject(base44, project) {
  const customerEmail = project.customer_email;
  
  if (!customerEmail) {
    return { 
      linkedCount: 0, 
      skippedCount: 0, 
      errorCount: 0,
      foundThreads: 0 
    };
  }

  console.log(`Searching for existing EmailThreads with customer email: ${customerEmail}`);

  // Search existing EmailThreads in the database that match the customer email
  const allThreads = await base44.asServiceRole.entities.EmailThread.list();
  const foundThreads = allThreads.filter(thread => {
    const fromMatches = thread.from_address?.toLowerCase().includes(customerEmail.toLowerCase());
    const toMatches = thread.to_addresses?.some(addr => 
      addr?.toLowerCase().includes(customerEmail.toLowerCase())
    );
    return fromMatches || toMatches;
  });

  console.log(`Found ${foundThreads.length} threads matching customer email`);

  let linkedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const thread of foundThreads) {
    try {
      // Skip if already linked to this project
      if (thread.project_id === project.id) {
        console.log(`Thread ${thread.id} already linked to project`);
        skippedCount++;
        continue;
      }

      // Link the thread to the project
      await base44.asServiceRole.functions.invoke('linkEmailThreadToProject', {
        threadId: thread.id,
        projectId: project.id
      });

      linkedCount++;
      console.log(`Linked thread ${thread.id} to project ${project.id}`);

      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`Error processing thread ${thread.id}:`, error);
      errorCount++;
      errors.push({
        thread_id: thread.id,
        error: error.message
      });
    }
  }

  return {
    foundThreads: foundThreads.length,
    linkedCount,
    skippedCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { projectId, batchMode } = await req.json();

    // Batch mode: process all projects
    if (batchMode) {
      const allProjects = await base44.asServiceRole.entities.Project.list();
      const activeProjects = allProjects.filter(p => !p.deleted_at);
      
      console.log(`Total active projects: ${activeProjects.length}`);

      // Fetch all customers to get emails
      const customers = await base44.asServiceRole.entities.Customer.list();
      const customerMap = new Map(customers.map(c => [c.id, c]));

      let totalLinked = 0;
      let totalSkipped = 0;
      let projectsProcessed = 0;
      let projectsWithoutEmail = 0;

      for (const project of activeProjects) {
        try {
          // Get customer email from project or customer entity
          let customerEmail = project.customer_email;
          
          if (!customerEmail && project.customer_id) {
            const customer = customerMap.get(project.customer_id);
            customerEmail = customer?.email;
          }

          if (!customerEmail) {
            projectsWithoutEmail++;
            continue;
          }

          // Add email to project for processing
          const projectWithEmail = { ...project, customer_email: customerEmail };
          
          const result = await processProject(base44, projectWithEmail);
          totalLinked += result.linkedCount;
          totalSkipped += result.skippedCount;
          projectsProcessed++;
          
          // Rate limiting between projects
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error processing project ${project.id}:`, error);
        }
      }

      return Response.json({
        success: true,
        batchMode: true,
        totalProjects: activeProjects.length,
        projectsProcessed,
        projectsWithoutEmail,
        totalLinked,
        totalSkipped
      });
    }

    // Single project mode
    if (!projectId) {
      return Response.json({ error: 'projectId is required when batchMode is false' }, { status: 400 });
    }

    const project = await base44.asServiceRole.entities.Project.get(projectId);
    
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const result = await processProject(base44, project);
    
    return Response.json({
      success: true,
      customerEmail: project.customer_email,
      ...result
    });

  } catch (error) {
    console.error('Error in autoLinkProjectEmails:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});