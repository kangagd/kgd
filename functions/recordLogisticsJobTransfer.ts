import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEPRECATED: recordLogisticsJobTransfer
 *
 * This function is RETIRED and no longer mutates inventory.
 * Use processLogisticsJobStockActions instead for orchestrated stock movements.
 *
 * Rationale:
 * - Inventory mutations must only happen via canonical writers (receivePoItems, moveInventory)
 * - Logistics jobs orchestrate transfers; they do not perform them directly
 * - All audit trails must be written by canonical functions with consistent reference fields
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({
      success: false,
      error: 'recordLogisticsJobTransfer is deprecated',
      message: 'Use processLogisticsJobStockActions instead',
      reason: 'Inventory mutations must be orchestrated via canonical writers (receivePoItems, moveInventory)',
      new_function: 'processLogisticsJobStockActions',
      documentation: 'See functions/processLogisticsJobStockActions.js for orchestration logic'
    }, { status: 410 }); // 410 Gone
  } catch (error) {
    console.error('recordLogisticsJobTransfer (deprecated):', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});