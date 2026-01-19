/**
 * Helper to get or create InventoryLocation for a supplier
 * Ensures all suppliers have a corresponding location for inventory tracking
 */
export async function getOrCreateSupplierInventoryLocation(base44, supplierId) {
  if (!supplierId) {
    throw new Error('supplier_id is required');
  }

  // Check if location already exists
  const existingLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
    type: 'supplier',
    supplier_id: supplierId
  });

  if (existingLocations.length > 0) {
    return existingLocations[0];
  }

  // Fetch supplier details
  const supplier = await base44.asServiceRole.entities.Supplier.get(supplierId);
  if (!supplier) {
    throw new Error(`Supplier not found: ${supplierId}`);
  }

  // Create new supplier location
  const location = await base44.asServiceRole.entities.InventoryLocation.create({
    name: `${supplier.name} (Supplier)`,
    type: 'supplier',
    supplier_id: supplierId,
    address: supplier.pickup_address || supplier.address_full || supplier.address_street || '',
    is_active: true,
    description: `Auto-created supplier location for ${supplier.name}`
  });

  return location;
}