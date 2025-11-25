import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

// Default permissions for each role
const ROLE_DEFAULTS = {
  administrator: {
    jobs: { view: true, create: true, edit: true, delete: true },
    projects: { view: true, create: true, edit: true, delete: true },
    customers: { view: true, create: true, edit: true, delete: true },
    invoicing: { view: true, create: true, edit: true, take_payment: true },
    reports: true,
    team_management: true,
    settings: true,
    price_list: { view: true, edit: true },
    inbox: { view: true, reply: true }
  },
  manager: {
    jobs: { view: true, create: true, edit: true, delete: false },
    projects: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    invoicing: { view: true, create: true, edit: true, take_payment: true },
    reports: true,
    team_management: false,
    settings: false,
    price_list: { view: true, edit: true },
    inbox: { view: true, reply: true }
  },
  office_staff: {
    jobs: { view: true, create: true, edit: true, delete: false },
    projects: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    invoicing: { view: true, create: true, edit: false, take_payment: false },
    reports: false,
    team_management: false,
    settings: false,
    price_list: { view: true, edit: false },
    inbox: { view: true, reply: true }
  },
  technician: {
    jobs: { view: true, create: false, edit: true, delete: false },
    projects: { view: true, create: false, edit: false, delete: false },
    customers: { view: true, create: false, edit: false, delete: false },
    invoicing: { view: false, create: false, edit: false, take_payment: false },
    reports: false,
    team_management: false,
    settings: false,
    price_list: { view: true, edit: false },
    inbox: { view: false, reply: false }
  }
};

export function getDefaultPermissions(userRole) {
  return ROLE_DEFAULTS[userRole] || ROLE_DEFAULTS.technician;
}

export function usePermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user for permissions:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const permissions = useMemo(() => {
    if (!user) return null;

    // Admin role (built-in) always has full access
    if (user.role === 'admin') {
      return ROLE_DEFAULTS.administrator;
    }

    // Use custom permissions if set, otherwise use role defaults
    const userRole = user.user_role || 'technician';
    const defaults = getDefaultPermissions(userRole);
    
    if (user.permissions) {
      // Merge custom permissions with defaults
      return deepMerge(defaults, user.permissions);
    }
    
    return defaults;
  }, [user]);

  const can = (resource, action) => {
    if (!permissions) return false;
    
    const resourcePerms = permissions[resource];
    if (typeof resourcePerms === 'boolean') {
      return resourcePerms;
    }
    if (typeof resourcePerms === 'object' && resourcePerms !== null) {
      return resourcePerms[action] === true;
    }
    return false;
  };

  const isAdmin = user?.role === 'admin' || user?.user_role === 'administrator';
  const isManager = user?.user_role === 'manager';
  const isTechnician = user?.is_field_technician || user?.user_role === 'technician';

  return {
    user,
    permissions,
    loading,
    can,
    isAdmin,
    isManager,
    isTechnician,
    userRole: user?.user_role || (user?.role === 'admin' ? 'administrator' : 'technician')
  };
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}

export { ROLE_DEFAULTS };