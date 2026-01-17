# Clean Inventory Movement System - Implementation Reference

## 4 Core Workflows + 4 Modals

### WORKFLOW A: RECEIVE (Supplier → Warehouse)
**User Intent:** "Stock arrived from supplier"

| Location | Screen | Button | Modal | Backend Function |
|----------|--------|--------|-------|------------------|
| Purchasing | Purchase Order Detail | "Receive Items" | `ReceivePurchaseOrderModal.jsx` | `recordStockMovement()` |

**Flow:**
1. User opens PO detail
2. Clicks "Receive Items"
3. Modal shows: PO lines, qty received (read-only), qty to receive now (input)
4. Auto-selects first active warehouse (type='warehouse', is_active!=false)
5. User enters qty received per line
6. On Save: calls `recordStockMovement()` for each line item:
   ```javascript
   {
     movement_type: "receive",
     price_list_item_id: line.price_list_item_id,
     location_id: warehouseLocationId,
     quantity: qty,
     reference_type: "purchase_order",
     reference_id: po.id,
     ...
   }
   ```
7. Backend increments InventoryQuantity, updates POLine.qty_received
8. Inbound automatically decreases (derived from qty_ordered - qty_received)

---

### WORKFLOW B: TRANSFER (Warehouse ↔ Vehicle)
**User Intent:** "I am loading/unloading stock"

| Location | Screen | Button | Modal | Backend Function |
|----------|--------|--------|-------|------------------|
| Warehouse | Inventory | "Transfer Stock" (per row) | `UnifiedStockTransferModal.jsx` | `recordStockMovement()` |
| My Vehicle | Inventory | "Load from Warehouse" | `UnifiedStockTransferModal.jsx` | `recordStockMovement()` |
| My Vehicle | Inventory | "Return to Warehouse" | `UnifiedStockTransferModal.jsx` | `recordStockMovement()` |
| Price List | SKU Detail | "Transfer Stock" | `UnifiedStockTransferModal.jsx` | `recordStockMovement()` |

**Flow:**
1. User opens screen with stock
2. Clicks "Transfer Stock" or "Load from Warehouse" / "Return to Warehouse"
3. Modal opens with:
   - SKU preselected (if launched from context)
   - From location (defaults: current location if available)
   - To location (defaults: opposite location if context known)
   - Quantity input
4. User adjusts locations/qty as needed
5. On Save: calls `recordStockMovement()`:
   ```javascript
   {
     movement_type: "transfer",
     price_list_item_id,
     location_id: fromLocationId,  // ??? CLARIFY: v1 API expects location_id not fromLocationId
     qty, // or quantity
     reference_type: "transfer",
     ...
   }
   ```
6. Backend decrements from location, increments to location
7. Creates StockMovement audit record

**Note:** Unified modal is reused everywhere to reduce confusion.

---

### WORKFLOW C: USAGE (Vehicle/Warehouse → Job)
**User Intent:** "I used this part on the job"

| Location | Screen | Button | Modal | Backend Function |
|----------|--------|--------|-------|------------------|
| Job Detail | Materials/Parts | "Use Part" | `JobItemsUsedModal.jsx` | `recordStockMovement()` |

**Flow:**
1. User opens Job Detail
2. Clicks "Use Part" button in Materials section
3. Modal shows:
   - SKU selector
   - Qty used
   - Source location selector (defaults to technician vehicle if available)
4. User selects or confirms values
5. On Save: calls `recordStockMovement()`:
   ```javascript
   {
     movement_type: "job_usage",
     price_list_item_id,
     location_id: sourceLocationId,  // where taken from
     qty: -ABS(qty),  // or just positive qty?
     reference_type: "job",
     reference_id: job.id,
     project_id: job.project_id,
     ...
   }
   ```
6. Backend decrements InventoryQuantity at sourceLocation
7. Existing logic: adds cost to Project.materials_cost

---

### WORKFLOW D: ADJUSTMENT (Admin-only)
**User Intent:** "The count is wrong" (stocktake/lost/damaged)

| Location | Screen | Button | Modal | Backend Function |
|----------|--------|--------|-------|------------------|
| Warehouse | Inventory | "Adjust Stock" (Admin) | `StockAdjustmentAdminModal.jsx` | `recordStockMovement()` |
| My Vehicle | Inventory | "Adjust Stock" (Admin) | `StockAdjustmentAdminModal.jsx` | `recordStockMovement()` |
| Price List | SKU Detail | "Adjust Stock" (Admin) | `StockAdjustmentAdminModal.jsx` | `recordStockMovement()` |

**Flow:**
1. Admin only (enforced by backend)
2. Opens screen with inventory
3. Clicks "Adjust Stock"
4. Modal shows:
   - Current quantity (read-only)
   - Adjustment qty (±)
   - Reason (required)
   - Location (preselected)
5. User enters adjustment and reason
6. On Save: calls `recordStockMovement()`:
   ```javascript
   {
     movement_type: "adjustment",
     price_list_item_id,
     location_id,
     qty: adjustmentQty,  // ± positive/negative
     reference_type: "manual_adjustment",
     notes: reason,
     ...
   }
   ```
7. Backend updates InventoryQuantity (add/subtract)
8. Creates auditable StockMovement record

---

## Visual Consistency: StockSummary Component

**Used in:**
- Price List rows
- Warehouse inventory list
- Vehicle inventory list  
- SKU detail panels
- Parts selectors

**Shows:**
```
On Hand:    [bold #111827]  SUM(InventoryQuantity) from active warehouse + vehicle
Inbound:    [secondary]     SUM(POLine.qty_ordered - qty_received) for open POs
Last:       [small text]    movement_type + time + location (e.g., "transfer to Van • 2h ago")
```

**If no movement:** "Last: none"

---

## Location Normalization & Filtering

**All operational dropdowns:**
- Show ONLY: active warehouse + active vehicle locations
- Hide: supplier, loading_bay, in_transit, inactive, other

**Normalization:**
```javascript
String(location.type || '').toLowerCase() === 'warehouse'
String(location.type || '').toLowerCase() === 'vehicle'
location.is_active !== false
```

**Utility:** `getPhysicalAvailableLocations(locations)` from `inventoryLocationUtils.js`

---

## Backend Function Payloads (Canonical Schema)

### recordStockMovement (general)
```javascript
{
  movement_type: "receive" | "transfer" | "job_usage" | "adjustment",
  price_list_item_id: string,
  location_id: string,  // for single-location ops (usage, adjustment)
  quantity: number,     // positive or negative
  reference_type?: string,
  reference_id?: string,
  notes?: string,
  ...
}
```

**OLD SCHEMA (DEPRECATED):**
- ~~quantity_delta~~
- ~~from_location_type~~ / ~~to_location_type~~
- ~~hardcoded warehouse_main~~

---

## Query Invalidation (post-success)

After any movement, invalidate:
- `['inventory-quantities']`
- `['vehicleStock']`
- `['warehouse-inventory']`
- `['priceListItems']`
- `['purchase-orders-by-supplier']` (if relevant)

---

## LOCKDOWN Checklist

- [ ] No direct writes to PriceListItem.stock_level
- [ ] No direct writes to VehicleStock (if exists)
- [ ] No legacy StockMovement fields
- [ ] All location filters use lowercase normalized type
- [ ] All operational dropdowns use `getPhysicalAvailableLocations()`
- [ ] ReceivePOLine defaults to active warehouse, not hardcoded name
- [ ] JobItemsUsedModal defaults to technician vehicle, falls back to warehouse

---

## Testing Checklist

1. **Receive:** PO qty_received increases, InventoryQuantity increases, inbound decreases
2. **Transfer:** From decreases, to increases, movement audit recorded
3. **Usage:** Source location decreases, project cost increases, movement recorded
4. **Adjustment:** Quantity updates, reason audited, admin-only enforced
5. **Stock Summary:** On Hand + Inbound + Last Movement consistent across all screens
6. **Location dropdown:** No case issues, no non-physical locations shown
7. **Query refresh:** All screens update after each movement