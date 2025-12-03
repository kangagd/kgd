import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const PermissionsContext = createContext(null);

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TECHNICIAN: 'technician',
  VIEWER: 'viewer'
};

// Define permissions for each role
const ROLE_PERMISSIONS = {
  admin: {
    canManageTeam: true,
    canViewFinancials: true,
    canEditPriceList: true,
    canViewReports: true,
    canViewArchive: true,
    canViewInbox: true,
    canEditProjects: true,
    canEditJobs: true,
    canEditCustomers: true,
    canCreateJobs: true,
    canCreateProjects: true,
    canDeleteRecords: true,
    canManageQuotes: true,
    canLinkEmails: true,
    canChangeProjectStage: true,
    canViewOrganisations: true,
    canEditOrganisations: true,
    fullNavigation: true,
  },
  manager: {
    canManageTeam: true,
    canViewFinancials: true,
    canEditPriceList: true,
    canViewReports: true,
    canViewArchive: true,
    canViewInbox: true,
    canEditProjects: true,
    canEditJobs: true,
    canEditCustomers: true,
    canCreateJobs: true,
    canCreateProjects: true,
    canDeleteRecords: true,
    canManageQuotes: true,
    canLinkEmails: true,
    canChangeProjectStage: true,
    canViewOrganisations: true,
    canEditOrganisations: true,
    fullNavigation: true,
  },
  technician: {
    canManageTeam: false,
    canViewFinancials: true,
    canEditPriceList: false,
    canViewReports: false,
    canViewArchive: false,
    canViewInbox: false,
    canEditProjects: false,
    canEditJobs: true, // Can edit jobs they're assigned to
    canEditCustomers: false,
    canCreateJobs: false,
    canCreateProjects: false,
    canDeleteRecords: false,
    canManageQuotes: false,
    canLinkEmails: false,
    canChangeProjectStage: false,
    canViewOrganisations: false,
    canEditOrganisations: false,
    fullNavigation: false,
  },
  viewer: {
    canManageTeam: false,
    canViewFinancials: false,
    canEditPriceList: false,
    canViewReports: false,
    canViewArchive: false,
    canViewInbox: false,
    canEditProjects: false,
    canEditJobs: false,
    canEditCustomers: false,
    canCreateJobs: false,
    canCreateProjects: false,
    canDeleteRecords: false,
    canManageQuotes: false,
    canLinkEmails: false,
    canChangeProjectStage: false,
    canViewOrganisations: true,
    canEditOrganisations: false,
    fullNavigation: false,
  },
};

export function PermissionsProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Determine effective role
  const getEffectiveRole = () => {
    if (!user) return 'viewer';
    
    // Admin role takes precedence
    if (user.role === 'admin') return 'admin';
    if (user.role === 'manager') return 'manager';
    
    // If user is a field technician, they get technician role
    if (user.is_field_technician) return 'technician';
    
    // Default to viewer for other users
    return user.role || 'viewer';
  };

  const role = getEffectiveRole();
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;

  const hasPermission = (permission) => {
    return permissions[permission] === true;
  };

  // Specific permission for detailed costs/margins
  const canViewCosts = role === 'admin' || role === 'manager';

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isTechnician = role === 'technician';
  const isViewer = role === 'viewer';
  const isAdminOrManager = isAdmin || isManager;

  const value = {
    user,
    loading,
    role,
    permissions,
    hasPermission,
    canViewCosts,
    isAdmin,
    isManager,
    isTechnician,
    isViewer,
    isAdminOrManager,
    refreshUser: async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    }
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

// Helper component to conditionally render based on permission
export function RequirePermission({ permission, children, fallback = null }) {
  const { hasPermission } = usePermissions();
  
  if (hasPermission(permission)) {
    return children;
  }
  
  return fallback;
}

// Helper component for admin/manager only content
export function AdminOnly({ children, fallback = null }) {
  const { isAdminOrManager } = usePermissions();
  return isAdminOrManager ? children : fallback;
}

// Role badge component
export function RoleBadge({ role, className = "" }) {
  const roleStyles = {
    admin: "bg-purple-100 text-purple-800",
    manager: "bg-blue-100 text-blue-800",
    technician: "bg-[#FAE008]/20 text-[#92400E]",
    viewer: "bg-gray-100 text-gray-600",
  };

  const roleLabels = {
    admin: "Admin",
    manager: "Manager",
    technician: "Technician",
    viewer: "Viewer",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleStyles[role] || roleStyles.viewer} ${className}`}>
      {roleLabels[role] || "User"}
    </span>
  );
}

export default PermissionsContext;