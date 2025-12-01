import React from "react";
import { usePermissions } from "@/components/common/PermissionsContext";
import AccessDenied from "@/components/common/AccessDenied";

export default function RequirePermission({
  permission,
  anyOf,
  roles,
  fallback,
  children,
}) {
  const { hasPermission, role } = usePermissions();

  let isAllowed = true;

  // Check specific roles
  if (roles && roles.length > 0) {
    isAllowed = isAllowed && roles.includes(role);
  }

  // Check specific permission
  if (permission) {
    isAllowed = isAllowed && hasPermission(permission);
  }

  // Check anyOf (permissions or roles)
  if (anyOf && anyOf.length > 0) {
    const hasAny = anyOf.some(
      (item) => hasPermission(item) || item === role
    );
    isAllowed = isAllowed && hasAny;
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  return <AccessDenied />;
}