// Helper to get or create supplier InventoryLocation
export async function getOrCreateSupplierInventoryLocation(base44, supplier_id) {
  if (!supplier_id) throw new Error('supplier_id is required');
  
  const existing = await base44.asServiceRole.entities.InventoryLocation.filter({
    type: 'supplier',
    supplier_id: supplier_id
  });
  
  if (existing.length > 0) return existing[0];
  
  let supplierName = 'Supplier';
  try {
    const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
    if (supplier) supplierName = supplier.name || 'Supplier';
  } catch (err) {
    console.warn(`Failed to fetch supplier ${supplier_id}:`, err);
  }
  
  return await base44.asServiceRole.entities.InventoryLocation.create({
    name: supplierName,
    type: 'supplier',
    supplier_id: supplier_id,
    is_active: true
  });
}