import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log('[cleanupDuplicates] Starting, user:', user?.email);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403 });
    }

    // Get all vehicle stock records
    const allStock = await base44.asServiceRole.entities.VehicleStock.list();
    console.log('[cleanupDuplicates] Found', allStock.length, 'total stock records');

    // Group by vehicle_id + product_id
    const grouped = {};
    for (const stock of allStock) {
      const key = `${stock.vehicle_id}_${stock.product_id}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(stock);
    }

    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    const removedRecords = [];

    // Find and remove duplicates (keep the one with higher quantity or most recent)
    for (const [key, records] of Object.entries(grouped)) {
      if (records.length > 1) {
        duplicatesFound++;
        console.log('[cleanupDuplicates] Found', records.length, 'duplicates for', key);
        
        // Sort by quantity (desc) then by updated_date (desc)
        records.sort((a, b) => {
          if (b.quantity_on_hand !== a.quantity_on_hand) {
            return b.quantity_on_hand - a.quantity_on_hand;
          }
          return new Date(b.updated_date) - new Date(a.updated_date);
        });

        // Keep the first one, delete the rest
        const toKeep = records[0];
        const toDelete = records.slice(1);

        console.log('[cleanupDuplicates] Keeping:', toKeep.id, 'with qty', toKeep.quantity_on_hand);
        
        for (const duplicate of toDelete) {
          console.log('[cleanupDuplicates] Deleting duplicate:', duplicate.id, 'with qty', duplicate.quantity_on_hand);
          await base44.asServiceRole.entities.VehicleStock.delete(duplicate.id);
          duplicatesRemoved++;
          removedRecords.push({
            id: duplicate.id,
            vehicle_id: duplicate.vehicle_id,
            product_id: duplicate.product_id,
            product_name: duplicate.product_name,
            quantity: duplicate.quantity_on_hand
          });
        }
      }
    }

    console.log('[cleanupDuplicates] Complete! Found', duplicatesFound, 'duplicate sets, removed', duplicatesRemoved, 'records');
    
    return Response.json({ 
      success: true,
      duplicates_found: duplicatesFound,
      duplicates_removed: duplicatesRemoved,
      removed_records: removedRecords
    });
  } catch (error) {
    console.error('[cleanupDuplicates] Fatal error:', error.message);
    console.error('[cleanupDuplicates] Stack:', error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});