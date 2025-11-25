import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DEFAULT_PERMISSIONS } from "./permissionsConfig";

// Hook to get user permissions
export function usePermissions() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: customRole, isLoading: roleLoading } = useQuery({
    queryKey: ['userRole', user?.custom_role_id],
    queryFn: () => user?.custom_role_id ? base44.entities.Role.get(user.custom_role_id) : null,
    enabled: !!user?.custom_role_id,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = userLoading || roleLoading;

  // Determine effective permissions
  const getPermissions = () => {
    if (!user) return null;

    // If user has custom role, use that
    if (customRole?.permissions) {
      return customRole.permissions;
    }

    // Otherwise, use default permissions based on role
    if (user.role === 'admin') {
      return DEFAULT_PERMISSIONS.administrator;
    }

    if (user.is_field_technician) {
      return DEFAULT_PERMISSIONS.technician;
    }

    // Default to read-only for regular users
    return DEFAULT_PERMISSIONS.read_only;
  };

  const permissions = getPermissions();

  // Check specific permission
  const can = (category, action) => {
    if (!permissions) return false;
    
    // Admins always have full access (unless they have a custom role)
    if (user?.role === 'admin' && !user?.custom_role_id) {
      return true;
    }

    return permissions[category]?.[action] === true;
  };

  // Check if user can access a page/feature
  const canAccess = (feature) => {
    if (!permissions) return false;
    
    // Admins always have access
    if (user?.role === 'admin' && !user?.custom_role_id) {
      return true;
    }

    switch (feature) {
      case 'projects':
        return can('projects', 'view');
      case 'jobs':
        return can('jobs', 'view');
      case 'customers':
        return can('customers', 'view');
      case 'schedule':
        return can('schedule', 'view') || can('schedule', 'view_own_only');
      case 'inbox':
        return can('inbox', 'view');
      case 'reports':
        return can('reports', 'view');
      case 'team':
        return can('team', 'view');
      case 'settings':
        return can('settings', 'view');
      case 'price_list':
        return can('price_list', 'view');
      case 'photos':
        return can('photos', 'view');
      case 'organisations':
        return can('organisations', 'view');
      case 'quotes':
        return can('quotes', 'view');
      case 'invoices':
        return can('invoices', 'view');
      default:
        return false;
    }
  };

  // Get role display name
  const getRoleName = () => {
    if (customRole) return customRole.name;
    if (user?.role === 'admin') return 'Administrator';
    if (user?.is_field_technician) return 'Technician';
    return 'User';
  };

  return {
    user,
    permissions,
    isLoading,
    can,
    canAccess,
    roleName: getRoleName(),
    isAdmin: user?.role === 'admin' && !user?.custom_role_id,
    isTechnician: user?.is_field_technician,
    customRole
  };
}

// Utility to check permissions outside of React components
export async function checkPermission(category, action) {
  try {
    const user = await base44.auth.me();
    
    if (user.role === 'admin' && !user.custom_role_id) {
      return true;
    }

    if (user.custom_role_id) {
      const role = await base44.entities.Role.get(user.custom_role_id);
      return role?.permissions?.[category]?.[action] === true;
    }

    // Default permissions
    if (user.role === 'admin') {
      return DEFAULT_PERMISSIONS.administrator[category]?.[action] === true;
    }
    if (user.is_field_technician) {
      return DEFAULT_PERMISSIONS.technician[category]?.[action] === true;
    }
    
    return DEFAULT_PERMISSIONS.read_only[category]?.[action] === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}