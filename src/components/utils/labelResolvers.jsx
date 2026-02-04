/**
 * Shared label resolver utility for displaying user-friendly identifiers
 * instead of raw IDs across the app.
 * 
 * Each resolver returns a formatted label.
 * If required data is missing, falls back gracefully.
 */

export const resolveProjectLabel = (project) => {
  if (!project) return 'Unknown Project';
  const number = project.project_number || project.id?.substring(0, 6);
  const title = project.title || project.name || project.project_title || '(no title)';
  return `#${number} ${title}`;
};

export const resolveJobLabel = (job) => {
  if (!job) return 'Unknown Job';
  const number = job.job_number || job.id?.substring(0, 6);
  const title = job.customer_name || job.job_type_name || '(no title)';
  return `#${number} ${title}`;
};

export const resolveCatalogItemLabel = (item) => {
  if (!item) return 'Unknown Item';
  return item.item || item.description || item.id?.substring(0, 6);
};

export const resolveLocationLabel = (location) => {
  if (!location) return 'Unknown Location';
  return location.name || location.location_code || location.id?.substring(0, 6);
};

export const resolveVehicleLabel = (vehicle) => {
  if (!vehicle) return 'Unknown Vehicle';
  return vehicle.name || vehicle.registration_plate || vehicle.id?.substring(0, 6);
};

export const resolveVisitLabel = (visit) => {
  if (!visit) return 'Unknown Visit';
  return `Visit ${visit.visit_number || '(no #)'}`;
};

export const resolvePurchaseOrderLabel = (po) => {
  if (!po) return 'Unknown PO';
  const poNum = po.purchase_order_number || po.po_number || po.reference_number || po.supplier_po_number || null;
  const supplier = po.supplier_name || null;
  if (poNum && supplier) return `PO #${poNum} - ${supplier}`;
  if (poNum) return `PO #${poNum}`;
  if (supplier) return supplier;
  return po.id?.substring(0, 6);
};

/**
 * Helper to fetch missing entity and return label + optional callback for backfill
 * Usage: const { label, entity } = await fetchAndResolveLabel('Project', projectId, resolveProjectLabel);
 */
export const fetchAndResolveLabel = async (entityType, entityId, resolver, base44) => {
  if (!entityId || !base44) {
    return { label: 'Unknown', entity: null };
  }
  
  try {
    const entity = await base44.entities[entityType].get(entityId);
    const label = resolver(entity);
    return { label, entity };
  } catch (error) {
    console.warn(`[labelResolvers] Failed to fetch ${entityType} ${entityId}:`, error);
    return { label: `${entityType} ${entityId?.substring(0, 6)}`, entity: null };
  }
};