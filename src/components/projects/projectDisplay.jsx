/**
 * Display-safe project field getters with fallback chains
 * Ensures consistent, non-empty labels across UI
 */

export function getProjectDisplayTitle(project) {
  if (!project) return "Untitled Project";
  
  const title = project?.title?.trim();
  if (title) return title;
  
  const projectName = project?.project_name?.trim();
  if (projectName) return projectName;
  
  const customerName = project?.customer_name?.trim();
  if (customerName) return customerName;
  
  return "Untitled Project";
}

export function getProjectDisplayAddress(project) {
  if (!project) return "";
  
  // Primary fallback: full address
  const fullAddress = project?.address_full?.trim();
  if (fullAddress) return fullAddress;
  
  // Secondary fallback: legacy address field
  const legacyAddress = project?.address?.trim();
  if (legacyAddress) return legacyAddress;
  
  // Tertiary fallback: compose from parts
  const parts = [
    project?.address_street?.trim(),
    project?.address_suburb?.trim(),
    project?.address_state?.trim(),
    project?.address_postcode?.trim()
  ].filter(Boolean);
  
  if (parts.length > 0) return parts.join(", ");
  
  return "";
}

export function getProjectCustomerLabel(project) {
  if (!project) return "Unknown Customer";
  
  const customerName = project?.customer_name?.trim();
  if (customerName) return customerName;
  
  // Fallback to nested customer object if available
  const nestedCustomerName = project?.customer?.name?.trim?.();
  if (nestedCustomerName) return nestedCustomerName;
  
  return "Unknown Customer";
}