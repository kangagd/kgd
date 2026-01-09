/**
 * Centralized Role-Based Permissions Configuration
 * 
 * This is the single source of truth for all RLS and permissions.
 * Any changes to permissions should be made here first.
 * 
 * Field-level restrictions are enforced in backend functions.
 */

// Financial fields that should be hidden from Technicians and Managers
export const RESTRICTED_FIELDS = {
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

// Complete entity permissions map
export const ENTITY_PERMISSIONS = {
  
  // ============================================
  // TECHNICIAN PERMISSIONS
  // ============================================
  
  technician: {
    // Read ALL records
    read: [
      'Job', 'Project', 'Customer', 'Organisation',
      'XeroInvoice', 'Quote', 'PriceListItem',
      'InventoryQuantity', 'InventoryMovement', 'StockMovement', 'InventoryLocation',
      'TechnicianLeave', 'BusinessClosedDay',
      'JobMessage',
      'Vehicle', 'VehicleStock', 'VehicleTool', 'VehiclePartsHardwareAssignment',
      'ToolItem', 'PartsHardwareItem',
      'CheckInOut', 'Task', 'Sample', 'SampleMovement', 'ThirdPartyTrade',
      'PurchaseOrder', 'PurchaseOrderLine', 'Part'
    ],
    
    // Update with conditions
    update: [
      'Job', // Only where assigned_to includes their email
      'XeroInvoice', // Only where created_by = their email
      'InventoryQuantity', 'StockMovement',
      'JobMessage',
      'VehicleTool', 'VehiclePartsHardwareAssignment', // ALL vehicles
      'Task', 'Sample', 'SampleMovement'
    ],
    
    // Create
    create: [
      'XeroInvoice', 'JobMessage', 'CheckInOut'
    ],
    
    // Delete
    delete: []
  },
  
  // ============================================
  // MANAGER PERMISSIONS
  // ============================================
  
  manager: {
    // Read ALL records
    read: [
      // Everything technicians can read
      'Job', 'Project', 'Customer', 'Organisation',
      'XeroInvoice', 'Quote', 'PriceListItem',
      'InventoryQuantity', 'InventoryMovement', 'StockMovement', 'InventoryLocation',
      'TechnicianLeave', 'BusinessClosedDay',
      'JobMessage', 'ProjectMessage',
      'Vehicle', 'VehicleStock', 'VehicleTool', 'VehiclePartsHardwareAssignment',
      'ToolItem', 'PartsHardwareItem',
      'CheckInOut', 'Task', 'Sample', 'SampleMovement', 'ThirdPartyTrade',
      'PurchaseOrder', 'PurchaseOrderLine', 'Part',
      // Manager-specific
      'EmailThread', 'EmailMessage', 'EmailDraft', 'EmailPermission', 'AIEmailInsight', 'ProjectEmail',
      'ChangeHistory', 'HandoverReport', 'Photo',
      'JobContact', 'ProjectContact',
      'ProjectViewer', 'MessageTemplate', 'Notification', 'AttentionItem',
      'MaintenanceReminder'
    ],
    
    // Update ALL
    update: [
      'Job', 'Project', // Financial fields blocked by backend
      'XeroInvoice', 'Quote',
      'PriceListItem', // unit_cost, target_margin blocked by backend
      'Customer', 'Organisation',
      'TechnicianLeave', 'BusinessClosedDay',
      'JobMessage', 'ProjectMessage',
      'EmailThread', 'EmailMessage', 'EmailDraft', 'AIEmailInsight', 'ProjectEmail',
      'Task', 'Sample', 'SampleMovement', 'ThirdPartyTrade',
      'HandoverReport', 'Photo',
      'JobContact', 'ProjectContact',
      'ProjectViewer', 'MessageTemplate', 'Notification', 'AttentionItem',
      'MaintenanceReminder'
    ],
    
    // Create
    create: [
      'Job', 'Project', 'XeroInvoice',
      'Customer', 'Organisation',
      'JobMessage', 'ProjectMessage',
      'EmailThread', 'EmailMessage', 'EmailDraft',
      'Task', 'Sample', 'SampleMovement', 'ThirdPartyTrade',
      'JobContact', 'ProjectContact'
    ],
    
    // Delete
    delete: ['Task']
  },
  
  // ============================================
  // ADMIN PERMISSIONS
  // ============================================
  
  admin: {
    // Full CRUD on everything
    read: ['*'],
    update: ['*'],
    create: ['*'],
    delete: ['*']
  }
};

/**
 * Get effective role for a user
 */
export function getEffectiveRole(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  if (user.extended_role === 'manager' || user.role === 'manager') return 'manager';
  if (user.extended_role === 'technician' || user.is_field_technician === true) return 'technician';
  return null; // No permissions for other roles
}

/**
 * Check if user has permission for an entity operation
 */
export function hasPermission(user, entityName, operation) {
  const role = getEffectiveRole(user);
  if (!role) return false;
  
  const permissions = ENTITY_PERMISSIONS[role];
  if (!permissions) return false;
  
  // Admin has all permissions
  if (permissions[operation]?.includes('*')) return true;
  
  return permissions[operation]?.includes(entityName) || false;
}

/**
 * Get restricted fields for an entity based on user role
 */
export function getRestrictedFields(user, entityName) {
  const role = getEffectiveRole(user);
  
  // Admin has no restrictions
  if (role === 'admin') return [];
  
  // Technicians and Managers have same field restrictions
  if (role === 'technician' || role === 'manager') {
    return RESTRICTED_FIELDS[entityName] || [];
  }
  
  return [];
}

/**
 * Filter out restricted fields from entity data
 */
export function filterRestrictedFields(user, entityName, data) {
  const restrictedFields = getRestrictedFields(user, entityName);
  
  if (restrictedFields.length === 0) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => {
      const filtered = { ...item };
      restrictedFields.forEach(field => delete filtered[field]);
      return filtered;
    });
  }
  
  // Handle single object
  const filtered = { ...data };
  restrictedFields.forEach(field => delete filtered[field]);
  return filtered;
}

/**
 * Validate that update data doesn't contain restricted fields
 */
export function validateUpdateData(user, entityName, updateData) {
  const restrictedFields = getRestrictedFields(user, entityName);
  
  if (restrictedFields.length === 0) return { valid: true };
  
  const attemptedRestrictedFields = Object.keys(updateData).filter(key => 
    restrictedFields.includes(key)
  );
  
  if (attemptedRestrictedFields.length > 0) {
    return {
      valid: false,
      error: `Cannot update restricted fields: ${attemptedRestrictedFields.join(', ')}`,
      restrictedFields: attemptedRestrictedFields
    };
  }
  
  return { valid: true };
}

/**
 * Check if user can update a specific Job (technician constraint)
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
 * Check if user can update a specific XeroInvoice (technician constraint)
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