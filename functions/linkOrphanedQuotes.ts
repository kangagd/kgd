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
        let matchedProject = null;
        let matchMethod = null;
        
        // Method 1: Try to extract and match by project number
        const match = quote.name?.match(/#(\d+)/);
        if (match) {
          const projectNumber = parseInt(match[1], 10);
          const customerProjects = projectMap.get(quote.customer_id);
          
          if (customerProjects) {
            matchedProject = customerProjects.get(projectNumber);
            if (matchedProject) {
              matchMethod = 'project_number';
            }
          }
        }
        
        // Method 2: If no match yet, try matching by address (exact match)
        if (!matchedProject && quote.address_full && quote.customer_id) {
          const normalizedQuoteAddress = quote.address_full.toLowerCase().trim();
          const customerProjects = projectMap.get(quote.customer_id);
          
          if (customerProjects) {
            const customerProjectsList = Array.from(customerProjects.values());
            matchedProject = customerProjectsList.find(p => 
              p.address_full && p.address_full.toLowerCase().trim() === normalizedQuoteAddress
            );
            
            if (matchedProject) {
              matchMethod = 'address';
            }
          }
        }
        
        // Method 3: If still no match, try fuzzy matching by quote name vs project title
        if (!matchedProject && quote.name && quote.customer_id) {
          // Remove project number pattern and common prefixes
          const normalizedQuoteName = quote.name
            .toLowerCase()
            .replace(/#\d+/g, '')
            .replace(/^quote\s*-?\s*/i, '')
            .replace(/\s+for\s+/i, ' ')
            .trim();
          
          const customerProjects = projectMap.get(quote.customer_id);
          
          if (customerProjects && normalizedQuoteName.length > 10) {
            const customerProjectsList = Array.from(customerProjects.values());
            
            // Try exact substring match first
            matchedProject = customerProjectsList.find(p => {
              const normalizedProjectTitle = p.title.toLowerCase().trim();
              return normalizedQuoteName.includes(normalizedProjectTitle) || 
                     normalizedProjectTitle.includes(normalizedQuoteName);
            });
            
            // If no exact match, try matching key words (address, customer name components)
            if (!matchedProject) {
              const quoteWords = normalizedQuoteName.split(/\s+/).filter(w => w.length > 3);
              
              matchedProject = customerProjectsList.find(p => {
                const normalizedProjectTitle = p.title.toLowerCase().trim();
                const titleWords = normalizedProjectTitle.split(/\s+/);
                
                // Count matching words
                const matchCount = quoteWords.filter(qw => 
                  titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
                ).length;
                
                // Require at least 2 matching words
                return matchCount >= 2;
              });
            }
            
            if (matchedProject) {
              matchMethod = 'name_similarity';
            }
          }
        }
        
        // No match found - log detailed reason
        if (!matchedProject) {
          results.notMatched++;
          
          const customerProjects = projectMap.get(quote.customer_id);
          const availableProjectNumbers = customerProjects 
            ? Array.from(customerProjects.keys()) 
            : [];
          
          const extractedNumber = match ? parseInt(match[1], 10) : null;
          
          results.notMatchedReasons.push({
            quoteId: quote.id,
            quoteName: quote.name,
            customerId: quote.customer_id,
            customerName: quote.customer_name,
            quoteAddress: quote.address_full || 'N/A',
            extractedProjectNumber: extractedNumber,
            reason: !quote.customer_id 
              ? 'Quote has no customer_id'
              : !customerProjects 
                ? `No projects found for customer ${quote.customer_name} (${quote.customer_id})`
                : extractedNumber && !customerProjects.get(extractedNumber)
                  ? `Project #${extractedNumber} not found for customer. Available: ${availableProjectNumbers.join(', ')}`
                  : !quote.address_full && !extractedNumber
                    ? `No project number in name and no address to match. Customer has projects: ${availableProjectNumbers.join(', ')}`
                    : `No match found. Tried: ${extractedNumber ? `#${extractedNumber}, ` : ''}${quote.address_full ? 'address, ' : ''}name similarity. Available projects: ${availableProjectNumbers.join(', ')}`
          });
          continue;
        }

        // Link the quote to the project
        await base44.asServiceRole.entities.Quote.update(quote.id, {
          project_id: matchedProject.id,
          project_title: matchedProject.title
        });

        console.log(`Linked quote ${quote.id} to project ${matchedProject.id} via ${matchMethod}`);
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