/**
 * Backend Permission Helpers
 * 
 * These functions enforce role-based permissions and field-level restrictions
 * in backend functions. They work alongside entity-level RLS.
 * 
 * Usage in backend functions:
 * 1. await enforcePermission(base44, user, 'EntityName', 'read')
 * 2. const filtered = filterRestrictedFields(user, 'EntityName', data)
 * 3. await validateUpdate(user, 'EntityName', updateData)
 */

// Financial fields that should be hidden from Technicians and Managers
const RESTRICTED_FIELDS = {
  Project: [
    'total_project_value',
    'materials_cost', 
    'labour_cost',
    'other_costs',
    'financial_status',
    'financial_notes',
    'payments'
  ],
  PriceListItem: [
    'unit_cost',
    'target_margin'
  ]
};

/**
 * Get effective role for a user
 */
export function getEffectiveRole(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  if (user.extended_role === 'manager' || user.role === 'manager') return 'manager';
  if (user.extended_role === 'technician' || user.is_field_technician === true) return 'technician';
  return null;
}

/**
 * Filter out restricted fields from entity data
 */
export function filterRestrictedFields(user, entityName, data) {
  const role = getEffectiveRole(user);
  
  // Admin has no restrictions
  if (role === 'admin') return data;
  
  const restrictedFields = RESTRICTED_FIELDS[entityName];
  if (!restrictedFields || restrictedFields.length === 0) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => {
      const filtered = { ...item };
      restrictedFields.forEach(field => delete filtered[field]);
      return filtered;
    });
  }
  
  // Handle single object
  if (data && typeof data === 'object') {
    const filtered = { ...data };
    restrictedFields.forEach(field => delete filtered[field]);
    return filtered;
  }
  
  return data;
}

/**
 * Validate that update data doesn't contain restricted fields
 * Throws error if validation fails
 */
export function validateUpdate(user, entityName, updateData) {
  const role = getEffectiveRole(user);
  
  // Admin has no restrictions
  if (role === 'admin') return;
  
  const restrictedFields = RESTRICTED_FIELDS[entityName];
  if (!restrictedFields || restrictedFields.length === 0) return;
  
  const attemptedRestrictedFields = Object.keys(updateData).filter(key => 
    restrictedFields.includes(key)
  );
  
  if (attemptedRestrictedFields.length > 0) {
    throw new Error(`Permission denied: Cannot update restricted fields: ${attemptedRestrictedFields.join(', ')}`);
  }
}

/**
 * Check if user can update a specific Job
 * Technicians can only update jobs assigned to them
 */
export function canUpdateJob(user, job) {
  const role = getEffectiveRole(user);
  
  // Admin and Manager can update all jobs
  if (role === 'admin' || role === 'manager') return true;
  
  // Technicians can only update jobs assigned to them
  if (role === 'technician') {
    if (!job.assigned_to) return false;
    
    const userEmail = user.email?.toLowerCase().trim();
    
    if (Array.isArray(job.assigned_to)) {
      return job.assigned_to.some(email => 
        email?.toLowerCase().trim() === userEmail
      );
    }
    
    return job.assigned_to?.toLowerCase().trim() === userEmail;
  }
  
  return false;
}

/**
 * Enforce job update permission
 * Throws error if user cannot update the job
 */
export function enforceJobUpdatePermission(user, job) {
  if (!canUpdateJob(user, job)) {
    throw new Error('Permission denied: You can only update jobs assigned to you');
  }
}

/**
 * Check if user can update a specific XeroInvoice
 * Technicians can only update invoices they created
 */
export function canUpdateXeroInvoice(user, invoice) {
  const role = getEffectiveRole(user);
  
  // Admin and Manager can update all invoices
  if (role === 'admin' || role === 'manager') return true;
  
  // Technicians can only update invoices they created
  if (role === 'technician') {
    return invoice.created_by === user.email;
  }
  
  return false;
}

/**
 * Enforce invoice update permission
 * Throws error if user cannot update the invoice
 */
export function enforceInvoiceUpdatePermission(user, invoice) {
  if (!canUpdateXeroInvoice(user, invoice)) {
    throw new Error('Permission denied: You can only update invoices you created');
  }
}

/**
 * Check basic role-level permission
 */
export function hasRolePermission(user, requiredRoles) {
  const role = getEffectiveRole(user);
  if (!role) return false;
  
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(role);
  }
  
  return role === requiredRoles;
}

/**
 * Enforce role-level permission
 * Throws error if user doesn't have required role
 */
export function enforceRolePermission(user, requiredRoles, operationDescription = 'perform this operation') {
  if (!hasRolePermission(user, requiredRoles)) {
    const rolesList = Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles;
    throw new Error(`Permission denied: Only ${rolesList} can ${operationDescription}`);
  }
}