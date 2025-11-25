import React from "react";
import { usePermissions } from "./usePermissions";
import { Lock } from "lucide-react";

// Component to conditionally render based on permissions
export default function PermissionGate({ 
  category, 
  action, 
  children, 
  fallback = null,
  showLocked = false 
}) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasPermission = can(category, action);

  if (hasPermission) {
    return children;
  }

  if (showLocked) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-center">
          <Lock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">You don't have permission to access this feature.</p>
        </div>
      </div>
    );
  }

  return fallback;
}

// HOC to wrap pages with permission check
export function withPermission(WrappedComponent, category, action) {
  return function PermissionWrapper(props) {
    const { can, isLoading } = usePermissions();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading...</p>
          </div>
        </div>
      );
    }

    if (!can(category, action)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md p-8">
            <Lock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">
              You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}