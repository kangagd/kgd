import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

// Permission actions
export const PERMISSIONS = {
  EDIT_STOCK: "edit_stock",
  ADJUST_STOCK: "adjust_stock",
  DELETE_LINE_ITEM: "delete_line_item",
  CREATE_PO: "create_po",
  MARK_INVOICED: "mark_invoiced",
  EDIT_VEHICLE: "edit_vehicle",
  DELETE_PO: "delete_po",
  DELETE_JOB: "delete_job",
  DELETE_PROJECT: "delete_project",
  EDIT_FINANCIALS: "edit_financials",
};

/**
 * Check if user has permission to perform an action
 * @param {Object} user - Current user object
 * @param {string} action - Permission action from PERMISSIONS
 * @param {Object} [resource] - Optional resource context
 * @returns {boolean} - Whether user has permission
 */
export function can(user, action, resource = null) {
  if (!user) return false;

  // Admins can do everything
  if (user.role === 'admin') return true;

  // Default role-based permissions
  const defaultPermissions = {
    manager: [
      PERMISSIONS.EDIT_STOCK,
      PERMISSIONS.ADJUST_STOCK,
      PERMISSIONS.DELETE_LINE_ITEM,
      PERMISSIONS.CREATE_PO,
      PERMISSIONS.EDIT_VEHICLE,
      PERMISSIONS.DELETE_PO,
      PERMISSIONS.EDIT_FINANCIALS,
    ],
    user: [
      PERMISSIONS.EDIT_STOCK,
      PERMISSIONS.CREATE_PO,
    ],
    viewer: [],
  };

  const rolePerms = defaultPermissions[user.role] || [];
  return rolePerms.includes(action);
}

/**
 * React hook to get user permissions
 * @returns {Object} - { can: (action, resource) => boolean, isLoading, user }
 */
export function usePermissions() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    can: (action, resource) => can(user, action, resource),
    isLoading,
    user,
  };
}