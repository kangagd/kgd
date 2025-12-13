import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Service role for background processing
    const body = await req.json().catch(() => ({}));
    const { hoursAgo = 168, limit = 10 } = body; // Default to 7 days, limit 10 entities
    
    console.log(`[Background AI] Starting analysis - hoursAgo: ${hoursAgo}, limit: ${limit}`);
    
    const results = {
      processed: 0,
      flagsAdded: 0,
      errors: 0,
      entities: [],
      debug: {
        totalJobs: 0,
        totalProjects: 0,
        totalCustomers: 0
      }
    };
    
    // Fetch recent entities - just get all and limit in memory
    const [allJobs, allProjects, allCustomers] = await Promise.all([
      base44.asServiceRole.entities.Job.list('-created_date', 50),
      base44.asServiceRole.entities.Project.list('-created_date', 50),
      base44.asServiceRole.entities.Customer.list('-created_date', 50)
    ]);
    
    // Filter out deleted/cancelled and limit
    const jobs = allJobs.filter(e => !e.deleted_at && e.status !== 'Cancelled').slice(0, limit);
    const projects = allProjects.filter(e => !e.deleted_at && e.status !== 'Lost').slice(0, limit);
    const customers = allCustomers.filter(e => !e.deleted_at).slice(0, limit);
    
    results.debug.totalJobs = jobs.length;
    results.debug.totalProjects = projects.length;
    results.debug.totalCustomers = customers.length;
    
    console.log(`[Background AI] Processing ${jobs.length} jobs, ${projects.length} projects, ${customers.length} customers`);
    
    // Process each entity type
    const entityTypes = [
      { type: 'job', entities: jobs },
      { type: 'project', entities: projects },
      { type: 'customer', entities: customers }
    ];
    
    for (const { type, entities } of entityTypes) {
      for (const entity of entities) {
        try {
          results.processed++;
          
          // Get existing flags and parent flags for deduplication
          const existingFlags = entity.attention_flags || [];
          
          // If this is a job, also get project flags for hierarchy checking
          let parentFlags = [];
          if (type === 'job' && entity.project_id) {
            try {
              const project = await base44.asServiceRole.entities.Project.get(entity.project_id);
              parentFlags = project?.attention_flags || [];
            } catch (err) {
              console.log(`Could not fetch parent project for job ${entity.id}`);
            }
          }
          
          // Combine existing and parent flags for deduplication
          const allExistingFlags = [...existingFlags, ...parentFlags];
          
          // Call generateAIFlags with deduplication context
          const response = await base44.asServiceRole.functions.invoke('generateAIFlags', {
            entityType: type,
            entityId: entity.id,
            existingFlags: allExistingFlags
          });
          
          if (response.data?.success && response.data?.suggestedFlags?.length > 0) {
            const suggestedFlags = response.data.suggestedFlags;
            
            // Get current flags
            const currentFlags = entity.attention_flags || [];
            
            // Only add flags that don't already exist (by label and type)
            const existingFlagKeys = new Set(
              currentFlags.map(f => `${f.type}:${f.label}`)
            );
            
            const newFlags = suggestedFlags.filter(
              flag => !existingFlagKeys.has(`${flag.type}:${flag.label}`)
            );
            
            if (newFlags.length > 0) {
              // Update entity with new flags
              const updatedFlags = [...currentFlags, ...newFlags];
              
              await base44.asServiceRole.entities[
                type === 'job' ? 'Job' : type === 'project' ? 'Project' : 'Customer'
              ].update(entity.id, {
                attention_flags: updatedFlags
              });
              
              results.flagsAdded += newFlags.length;
              results.entities.push({
                type,
                id: entity.id,
                name: entity.title || entity.customer_name || entity.name,
                newFlagsCount: newFlags.length
              });
              
              console.log(`[Background AI] Added ${newFlags.length} flags to ${type} ${entity.id}`);
            }
          }
        } catch (error) {
          results.errors++;
          console.error(`[Background AI] Error processing ${type} ${entity.id}:`, error.message);
        }
      }
    }
    
    console.log(`[Background AI] Complete: ${results.processed} processed, ${results.flagsAdded} flags added, ${results.errors} errors`);
    
    return Response.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('[Background AI] Fatal error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});