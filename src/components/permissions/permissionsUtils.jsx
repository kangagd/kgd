/**
 * Permissions utility functions for role-based access control
 */

// Default permissions for built-in roles
export const DEFAULT_ADMIN_PERMISSIONS = {
  jobs: { view: true, create: true, edit: true, delete: true },
  projects: { view: true, create: true, edit: true, delete: true },
  customers: { view: true, create: true, edit: true, delete: true },
  schedule: { view: true, edit: true },
  inbox: { view: true, reply: true },
  reports: { view: true },
  team: { view: true, manage: true },
  settings: { view: true, manage: true },
  priceList: { view: true, edit: true },
  photos: { view: true, upload: true, delete: true },
  organisations: { view: true, create: true, edit: true, delete: true },
  financials: { view: true, edit: true }
};

export const DEFAULT_EDITOR_PERMISSIONS = {
  jobs: { view: true, create: true, edit: true, delete: false },
  projects: { view: true, create: true, edit: true, delete: false },
  customers: { view: true, create: true, edit: true, delete: false },
  schedule: { view: true, edit: true },
  inbox: { view: true, reply: true },
  reports: { view: true },
  team: { view: true, manage: false },
  settings: { view: false, manage: false },
  priceList: { view: true, edit: false },
  photos: { view: true, upload: true, delete: false },
  organisations: { view: true, create: true, edit: true, delete: false },
  financials: { view: false, edit: false }
};

export const DEFAULT_VIEWER_PERMISSIONS = {
  jobs: { view: true, create: false, edit: false, delete: false },
  projects: { view: true, create: false, edit: false, delete: false },
  customers: { view: true, create: false, edit: false, delete: false },
  schedule: { view: true, edit: false },
  inbox: { view: true, reply: false },
  reports: { view: true },
  team: { view: true, manage: false },
  settings: { view: false, manage: false },
  priceList: { view: true, edit: false },
  photos: { view: true, upload: false, delete: false },
  organisations: { view: true, create: false, edit: false, delete: false },
  financials: { view: false, edit: false }
};

export const DEFAULT_TECHNICIAN_PERMISSIONS = {
  jobs: { view: true, create: true, edit: true, delete: false },
  projects: { view: true, create: false, edit: false, delete: false },
  customers: { view: true, create: true, edit: false, delete: false },
  schedule: { view: true, edit: false },
  inbox: { view: false, reply: false },
  reports: { view: false },
  team: { view: false, manage: false },
  settings: { view: false, manage: false },
  priceList: { view: true, edit: false },
  photos: { view: true, upload: true, delete: false },
  organisations: { view: false, create: false, edit: false, delete: false },
  financials: { view: false, edit: false }
};

/**
 * Get effective permissions for a user
 * @param {Object} user - User object with role info
 * @param {Object} customRole - Custom role object (if user has custom_role_id)
 * @returns {Object} Permissions object
 */
export function getUserPermissions(user, customRole = null) {
  // System admins always have full access
  if (user?.role === 'admin') {
    return DEFAULT_ADMIN_PERMISSIONS;
  }

  // If user has a custom role, use its permissions
  if (customRole?.permissions) {
    return customRole.permissions;
  }

  // Field technicians get technician permissions
  if (user?.is_field_technician) {
    return DEFAULT_TECHNICIAN_PERMISSIONS;
  }

  // Default to viewer permissions
  return DEFAULT_VIEWER_PERMISSIONS;
}

/**
 * Check if user has a specific permission
 * @param {Object} permissions - User's permissions object
 * @param {string} resource - Resource name (e.g., 'jobs', 'customers')
 * @param {string} action - Action name (e.g., 'view', 'create', 'edit', 'delete')
 * @returns {boolean}
 */
export function hasPermission(permissions, resource, action) {
  if (!permissions) return false;
  return permissions[resource]?.[action] === true;
}

/**
 * Check if user can access a page
 * @param {Object} permissions - User's permissions object
 * @param {string} pageName - Page name
 * @returns {boolean}
 */
export function canAccessPage(permissions, pageName) {
  if (!permissions) return false;

  const pagePermissionMap = {
    'Dashboard': true, // Everyone can see dashboard
    'Jobs': permissions.jobs?.view,
    'Projects': permissions.projects?.view,
    'Customers': permissions.customers?.view,
    'Schedule': permissions.schedule?.view,
    'Inbox': permissions.inbox?.view,
    'Reports': permissions.reports?.view,
    'Team': permissions.team?.view,
    'PriceList': permissions.priceList?.view,
    'Photos': permissions.photos?.view,
    'Organisations': permissions.organisations?.view,
    'Archive': permissions.jobs?.view || permissions.projects?.view,
    'UserProfile': true, // Everyone can see their profile
    'Tasks': true, // Everyone can see tasks
  };

  return pagePermissionMap[pageName] ?? false;
}

/**
 * Get list of permission categories for UI
 */
export function getPermissionCategories() {
  return [
    {
      key: 'jobs',
      label: 'Jobs',
      actions: ['view', 'create', 'edit', 'delete']
    },
    {
      key: 'projects',
      label: 'Projects',
      actions: ['view', 'create', 'edit', 'delete']
    },
    {
      key: 'customers',
      label: 'Customers',
      actions: ['view', 'create', 'edit', 'delete']
    },
    {
      key: 'organisations',
      label: 'Organisations',
      actions: ['view', 'create', 'edit', 'delete']
    },
    {
      key: 'schedule',
      label: 'Schedule',
      actions: ['view', 'edit']
    },
    {
      key: 'inbox',
      label: 'Inbox',
      actions: ['view', 'reply']
    },
    {
      key: 'reports',
      label: 'Reports',
      actions: ['view']
    },
    {
      key: 'team',
      label: 'Team',
      actions: ['view', 'manage']
    },
    {
      key: 'settings',
      label: 'Settings',
      actions: ['view', 'manage']
    },
    {
      key: 'priceList',
      label: 'Price List',
      actions: ['view', 'edit']
    },
    {
      key: 'photos',
      label: 'Photos',
      actions: ['view', 'upload', 'delete']
    },
    {
      key: 'financials',
      label: 'Financials',
      actions: ['view', 'edit']
    }
  ];
}

/**
 * Create empty permissions object
 */
export function createEmptyPermissions() {
  const permissions = {};
  getPermissionCategories().forEach(category => {
    permissions[category.key] = {};
    category.actions.forEach(action => {
      permissions[category.key][action] = false;
    });
  });
  return permissions;
}