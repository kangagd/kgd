// DEPRECATED - All vehicle stock management has been migrated to the new inventory system
// This function is no longer used. See the following for replacements:
// - Stock usage/consumption: Use StockUsageModal + moveInventory function
// - Stock adjustments: Use StockAdjustmentModal + moveInventory function
// - Restock requests: Use RestockRequestModal + createRestockRequest function
// - Adding items to vehicle: Use AddVehicleStockModal + moveInventory function

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    return Response.json({ 
        error: 'This function is deprecated. All vehicle stock management has been migrated to the new inventory system. Use moveInventory or related functions instead.' 
    }, { status: 410 });
});