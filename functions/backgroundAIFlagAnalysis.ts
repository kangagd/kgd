import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Service role for background processing
    const { hoursAgo = 24 } = await req.json().catch(() => ({}));
    
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);
    const cutoffISO = cutoffDate.toISOString();
    
    console.log(`[Background AI] Analyzing entities updated since ${cutoffISO}`);
    
    const results = {
      processed: 0,
      flagsAdded: 0,
      errors: 0,
      entities: []
    };
    
    // Fetch recently updated entities
    const [jobs, projects, customers] = await Promise.all([
      base44.asServiceRole.entities.Job.filter({
        updated_date: { $gte: cutoffISO },
        deleted_at: null,
        status: { $ne: 'Cancelled' }
      }),
      base44.asServiceRole.entities.Project.filter({
        updated_date: { $gte: cutoffISO },
        deleted_at: null
      }),
      base44.asServiceRole.entities.Customer.filter({
        updated_date: { $gte: cutoffISO },
        deleted_at: null
      })
    ]);
    
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