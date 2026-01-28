import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ⚠️ DEPRECATED FUNCTION - DO NOT USE
 * 
 * This function is deprecated and will be removed in a future version.
 * Use managePurchaseOrder with action: 'updateStatus' instead.
 * 
 * Reason: This function bypasses Part syncing and causes data drift.
 * 
 * Migration:
 *   OLD: base44.functions.invoke('updatePurchaseOrderStatus', { po_id, status })
 *   NEW: base44.functions.invoke('managePurchaseOrder', { action: 'updateStatus', id: po_id, status })
 */

Deno.serve(async (req) => {
  const errorMessage = `
╔═══════════════════════════════════════════════════════════════════════╗
║ ⛔ DEPRECATED FUNCTION CALLED: updatePurchaseOrderStatus             ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ This function has been DEPRECATED and should not be used.            ║
║                                                                       ║
║ REASON:                                                              ║
║ - Bypasses Part status/location syncing                             ║
║ - Does not trigger logistics job creation                           ║
║ - Causes data inconsistencies between POs and Parts                 ║
║                                                                       ║
║ MIGRATION:                                                           ║
║ Replace with: managePurchaseOrder (action: 'updateStatus')          ║
║                                                                       ║
║ Example:                                                             ║
║   base44.functions.invoke('managePurchaseOrder', {                  ║
║     action: 'updateStatus',                                          ║
║     id: po_id,                                                       ║
║     status: status                                                   ║
║   })                                                                 ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
  `.trim();

  console.error(errorMessage);

  try {
    const body = await req.json();
    console.error('[updatePurchaseOrderStatus] Called with payload:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('[updatePurchaseOrderStatus] Could not parse request body');
  }

  return Response.json({ 
    success: false,
    error: 'DEPRECATED: updatePurchaseOrderStatus has been removed. Use managePurchaseOrder with action: "updateStatus" instead.',
    migration_guide: {
      old_pattern: "base44.functions.invoke('updatePurchaseOrderStatus', { po_id, status })",
      new_pattern: "base44.functions.invoke('managePurchaseOrder', { action: 'updateStatus', id: po_id, status })"
    }
  }, { status: 410 }); // 410 Gone
});