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

  console.log(`Searching Gmail for emails with: ${customerEmail}`);

  const searchResult = await base44.asServiceRole.functions.invoke('searchGmailHistory', {
    query: customerEmail,
    maxResults: 50
  });

  if (!searchResult.data?.success) {
    return { 
      linkedCount: 0, 
      skippedCount: 0, 
      errorCount: 1,
      foundThreads: 0 
    };
  }

  const foundThreads = searchResult.data.threads || [];
  console.log(`Found ${foundThreads.length} threads from Gmail`);

  let linkedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const gmailThread of foundThreads) {
    try {
      const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({
        gmail_thread_id: gmailThread.gmail_thread_id
      });

      let threadId;

      if (existingThreads.length > 0) {
        threadId = existingThreads[0].id;
        
        if (existingThreads[0].project_id === project.id) {
          console.log(`Thread ${gmailThread.gmail_thread_id} already linked to project`);
          skippedCount++;
          continue;
        }
      } else {
        const newThread = await base44.asServiceRole.entities.EmailThread.create({
          gmail_thread_id: gmailThread.gmail_thread_id,
          subject: gmailThread.subject || 'No Subject',
          from_address: gmailThread.from_address,
          to_addresses: gmailThread.to_addresses || [],
          last_message_date: gmailThread.last_message_date,
          last_message_snippet: gmailThread.snippet,
          message_count: gmailThread.message_count || 1
        });
        threadId = newThread.id;
        console.log(`Created new EmailThread: ${threadId}`);
      }

      await base44.asServiceRole.functions.invoke('linkEmailThreadToProject', {
        threadId,
        projectId: project.id
      });

      linkedCount++;
      console.log(`Linked thread ${gmailThread.gmail_thread_id} to project ${project.id}`);

      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`Error processing thread ${gmailThread.gmail_thread_id}:`, error);
      errorCount++;
      errors.push({
        gmail_thread_id: gmailThread.gmail_thread_id,
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