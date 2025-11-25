import React from 'react';
import { usePermissions } from './usePermissions';

export default function PermissionGate({ 
  resource, 
  action, 
  children, 
  fallback = null,
  requireAdmin = false 
}) {
  const { can, isAdmin, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return fallback;
  }

  if (resource && action && !can(resource, action)) {
    return fallback;
  }

  return <>{children}</>;
}

// HOC for wrapping components with permission checks
export function withPermission(WrappedComponent, resource, action) {
  return function PermissionWrapper(props) {
    return (
      <PermissionGate resource={resource} action={action}>
        <WrappedComponent {...props} />
      </PermissionGate>
    );
  };
}