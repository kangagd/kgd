import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Auth check - admin only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all quotes with null project_id
    const orphanedQuotes = await base44.asServiceRole.entities.Quote.filter({ project_id: null });
    
    // Get all projects
    const projects = await base44.asServiceRole.entities.Project.list();
    
    // Create lookup map: customer_id -> { project_number -> project }
    const projectMap = new Map();
    for (const project of projects) {
      if (!project.project_number || !project.customer_id) continue;
      
      if (!projectMap.has(project.customer_id)) {
        projectMap.set(project.customer_id, new Map());
      }
      projectMap.get(project.customer_id).set(project.project_number, project);
    }

    const results = {
      total: orphanedQuotes.length,
      linked: 0,
      notMatched: 0,
      notMatchedReasons: [],
      errors: []
    };

    // Process each orphaned quote
    for (const quote of orphanedQuotes) {
      try {
        // Extract project number from quote name (e.g., "#3989" from "Quote - Garage Door for 154 Rainbow St (#3989)")
        const match = quote.name?.match(/#(\d+)/);
        if (!match) {
          results.notMatched++;
          results.notMatchedReasons.push({
            quoteId: quote.id,
            quoteName: quote.name,
            customerId: quote.customer_id,
            customerName: quote.customer_name,
            reason: "No project number found in quote name"
          });
          continue;
        }

        const projectNumber = parseInt(match[1], 10);
        
        // Find matching project by customer_id and project_number
        const customerProjects = projectMap.get(quote.customer_id);
        if (!customerProjects) {
          results.notMatched++;
          results.notMatchedReasons.push({
            quoteId: quote.id,
            quoteName: quote.name,
            customerId: quote.customer_id,
            customerName: quote.customer_name,
            projectNumber: projectNumber,
            reason: `No projects found for customer_id: ${quote.customer_id}`
          });
          continue;
        }

        let matchedProject = customerProjects.get(projectNumber);
        
        // If no match by project number, try matching by address
        if (!matchedProject && quote.address_full) {
          const normalizedQuoteAddress = quote.address_full.toLowerCase().trim();
          const customerProjectsList = Array.from(customerProjects.values());
          matchedProject = customerProjectsList.find(p => 
            p.address_full && p.address_full.toLowerCase().trim() === normalizedQuoteAddress
          );
          
          if (matchedProject) {
            console.log(`Matched quote ${quote.id} by address to project ${matchedProject.id}`);
          }
        }
        
        // If still no match, try fuzzy matching by quote name vs project title
        if (!matchedProject && quote.name) {
          const normalizedQuoteName = quote.name.toLowerCase().replace(/#\d+/g, '').trim();
          const customerProjectsList = Array.from(customerProjects.values());
          matchedProject = customerProjectsList.find(p => {
            const normalizedProjectTitle = p.title.toLowerCase().trim();
            // Check if quote name contains significant parts of project title
            return normalizedQuoteName.includes(normalizedProjectTitle) || 
                   normalizedProjectTitle.includes(normalizedQuoteName);
          });
          
          if (matchedProject) {
            console.log(`Matched quote ${quote.id} by name similarity to project ${matchedProject.id}`);
          }
        }
        
        if (!matchedProject) {
          results.notMatched++;
          const availableProjectNumbers = Array.from(customerProjects.keys());
          results.notMatchedReasons.push({
            quoteId: quote.id,
            quoteName: quote.name,
            customerId: quote.customer_id,
            customerName: quote.customer_name,
            quoteAddress: quote.address_full,
            projectNumber: projectNumber,
            reason: `No match found by project number #${projectNumber}, address, or name similarity. Available project numbers: ${availableProjectNumbers.join(', ')}`
          });
          continue;
        }

        // Link the quote to the project
        await base44.asServiceRole.entities.Quote.update(quote.id, {
          project_id: matchedProject.id,
          project_title: matchedProject.title
        });

        results.linked++;
      } catch (error) {
        results.errors.push({
          quoteId: quote.id,
          quoteName: quote.name,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error linking orphaned quotes:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});