import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getUserPermissions, hasPermission, canAccessPage } from './permissionsUtils';

/**
 * Hook to get and check user permissions
 * @param {Object} user - Current user object
 * @returns {Object} Permissions state and helper functions
 */
export function usePermissions(user) {
  // Fetch custom role if user has one
  const { data: customRole } = useQuery({
    queryKey: ['role', user?.custom_role_id],
    queryFn: () => base44.entities.Role.filter({ id: user.custom_role_id }),
    enabled: !!user?.custom_role_id,
    select: (data) => data?.[0] || null,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Calculate effective permissions
  const permissions = getUserPermissions(user, customRole);

  // Helper to check specific permission
  const can = useCallback((resource, action) => {
    return hasPermission(permissions, resource, action);
  }, [permissions]);

  // Helper to check page access
  const canAccess = useCallback((pageName) => {
    return canAccessPage(permissions, pageName);
  }, [permissions]);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  return {
    permissions,
    can,
    canAccess,
    isAdmin,
    customRole,
    isLoading: user?.custom_role_id && !customRole
  };
}

export default usePermissions;