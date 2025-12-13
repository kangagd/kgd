import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Service role for background processing
    const { hoursAgo = 168 } = await req.json().catch(() => ({})); // Default to 7 days
    
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);
    
    console.log(`[Background AI] Analyzing entities updated in last ${hoursAgo} hours`);
    
    const results = {
      processed: 0,
      flagsAdded: 0,
      errors: 0,
      entities: []
    };
    
    // Fetch all active entities (can't reliably filter by updated_at across all entities)
    // Instead, we'll fetch all and process them
    const [jobs, projects, customers] = await Promise.all([
      base44.asServiceRole.entities.Job.filter({
        status: { $ne: 'Cancelled' }
      }),
      base44.asServiceRole.entities.Project.filter({
        status: { $ne: 'Lost' }
      }),
      base44.asServiceRole.entities.Customer.filter({
        status: 'active'
      })
    ]).then(([j, p, c]) => {
      // Filter by update time in memory since field names vary
      const cutoff = cutoffDate.getTime();
      return [
        j.filter(e => !e.deleted_at && (new Date(e.updated_at || e.created_at).getTime() > cutoff)),
        p.filter(e => !e.deleted_at && (new Date(e.updated_at || e.created_at).getTime() > cutoff)),
        c.filter(e => !e.deleted_at && (new Date(e.updated_at || e.created_at).getTime() > cutoff))
      ];
    });
    
    console.log(`[Background AI] Found ${jobs.length} jobs, ${projects.length} projects, ${customers.length} customers`);
    
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
          
          // Call generateAIFlags
          const response = await base44.asServiceRole.functions.invoke('generateAIFlags', {
            entityType: type,
            entityId: entity.id
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