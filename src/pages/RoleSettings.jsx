import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, ShieldCheck, Wrench, Eye, Save, RotateCcw,
  Briefcase, FolderKanban, Users, Building2, FileText,
  DollarSign, Archive, Mail, Camera, CheckSquare, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import AccessDenied from "@/components/common/AccessDenied";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";

const ROLES = [
  { id: "admin", label: "Admin", icon: ShieldCheck, color: "bg-purple-100 text-purple-700" },
  { id: "manager", label: "Manager", icon: Shield, color: "bg-blue-100 text-blue-700" },
  { id: "technician", label: "Technician", icon: Wrench, color: "bg-amber-100 text-amber-700" },
  { id: "viewer", label: "Viewer", icon: Eye, color: "bg-gray-100 text-gray-700" }
];

const PERMISSION_GROUPS = [
  {
    title: "Jobs",
    icon: Briefcase,
    permissions: [
      { key: "canCreateJobs", label: "Create Jobs" },
      { key: "canEditJobs", label: "Edit Jobs" },
      { key: "canDeleteJobs", label: "Delete Jobs" },
      { key: "canViewAllJobs", label: "View All Jobs" },
      { key: "canCheckInOut", label: "Check In/Out" }
    ]
  },
  {
    title: "Projects",
    icon: FolderKanban,
    permissions: [
      { key: "canCreateProjects", label: "Create Projects" },
      { key: "canEditProjects", label: "Edit Projects" },
      { key: "canDeleteProjects", label: "Delete Projects" },
      { key: "canViewAllProjects", label: "View All Projects" }
    ]
  },
  {
    title: "Customers",
    icon: Users,
    permissions: [
      { key: "canCreateCustomers", label: "Create Customers" },
      { key: "canEditCustomers", label: "Edit Customers" },
      { key: "canDeleteCustomers", label: "Delete Customers" },
      { key: "canViewAllCustomers", label: "View All Customers" }
    ]
  },
  {
    title: "Team & Organisations",
    icon: Building2,
    permissions: [
      { key: "canManageTeam", label: "Manage Team Members" },
      { key: "canManageOrganisations", label: "Manage Organisations" }
    ]
  },
  {
    title: "Financials & Invoicing",
    icon: DollarSign,
    permissions: [
      { key: "canViewFinancials", label: "View Financials" },
      { key: "canCreateInvoices", label: "Create Invoices" },
      { key: "canManageQuotes", label: "Manage Quotes" },
      { key: "canManagePriceList", label: "Manage Price List" },
      { key: "canAdjustStock", label: "Adjust Stock Levels" }
    ]
  },
  {
    title: "Reports & Data",
    icon: TrendingUp,
    permissions: [
      { key: "canViewReports", label: "View Reports" },
      { key: "canViewArchive", label: "View Archive" },
      { key: "canRestoreArchived", label: "Restore Archived Items" }
    ]
  },
  {
    title: "Communication & Media",
    icon: Mail,
    permissions: [
      { key: "canAccessInbox", label: "Access Inbox" },
      { key: "canUploadPhotos", label: "Upload Photos" },
      { key: "canManageTasks", label: "Manage Tasks" }
    ]
  }
];

const DEFAULT_PERMISSIONS = {
  admin: {
    canCreateJobs: true, canEditJobs: true, canDeleteJobs: true, canViewAllJobs: true,
    canCreateProjects: true, canEditProjects: true, canDeleteProjects: true, canViewAllProjects: true,
    canCreateCustomers: true, canEditCustomers: true, canDeleteCustomers: true, canViewAllCustomers: true,
    canManageTeam: true, canManageOrganisations: true, canViewReports: true,
    canManagePriceList: true, canAdjustStock: true, canViewArchive: true, canRestoreArchived: true,
    canAccessInbox: true, canCreateInvoices: true, canViewFinancials: true, canManageQuotes: true,
    canCheckInOut: true, canUploadPhotos: true, canManageTasks: true
  },
  manager: {
    canCreateJobs: true, canEditJobs: true, canDeleteJobs: false, canViewAllJobs: true,
    canCreateProjects: true, canEditProjects: true, canDeleteProjects: false, canViewAllProjects: true,
    canCreateCustomers: true, canEditCustomers: true, canDeleteCustomers: false, canViewAllCustomers: true,
    canManageTeam: true, canManageOrganisations: true, canViewReports: true,
    canManagePriceList: true, canAdjustStock: true, canViewArchive: true, canRestoreArchived: true,
    canAccessInbox: true, canCreateInvoices: true, canViewFinancials: true, canManageQuotes: true,
    canCheckInOut: true, canUploadPhotos: true, canManageTasks: true
  },
  technician: {
    canCreateJobs: true, canEditJobs: true, canDeleteJobs: false, canViewAllJobs: false,
    canCreateProjects: false, canEditProjects: false, canDeleteProjects: false, canViewAllProjects: false,
    canCreateCustomers: true, canEditCustomers: true, canDeleteCustomers: false, canViewAllCustomers: true,
    canManageTeam: false, canManageOrganisations: false, canViewReports: false,
    canManagePriceList: false, canAdjustStock: false, canViewArchive: false, canRestoreArchived: false,
    canAccessInbox: false, canCreateInvoices: false, canViewFinancials: false, canManageQuotes: false,
    canCheckInOut: true, canUploadPhotos: true, canManageTasks: true
  },
  viewer: {
    canCreateJobs: false, canEditJobs: false, canDeleteJobs: false, canViewAllJobs: true,
    canCreateProjects: false, canEditProjects: false, canDeleteProjects: false, canViewAllProjects: true,
    canCreateCustomers: false, canEditCustomers: false, canDeleteCustomers: false, canViewAllCustomers: true,
    canManageTeam: false, canManageOrganisations: false, canViewReports: false,
    canManagePriceList: false, canAdjustStock: false, canViewArchive: false, canRestoreArchived: false,
    canAccessInbox: false, canCreateInvoices: false, canViewFinancials: false, canManageQuotes: false,
    canCheckInOut: false, canUploadPhotos: false, canManageTasks: false
  }
};

export default function RoleSettings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("admin");
  const [localPermissions, setLocalPermissions] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const queryClient = useQueryClient();

  const runBackfill = async () => {
    setBackfillRunning(true);
    try {
      const response = await base44.functions.invoke('backfillJobsToProjects');
      const results = response.data.results;
      toast.success(`Synced ${results.synced}/${results.total} jobs to projects`);
      if (results.errors.length > 0) {
        console.log('Backfill errors:', results.errors);
      }
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setBackfillRunning(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        setCurrentUser(await base44.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: rolePermissions = [], isLoading } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: () => base44.entities.RolePermissions.list(),
    enabled: currentUser?.role === 'admin'
  });

  // Initialize local permissions from DB or defaults
  useEffect(() => {
    const permsMap = {};
    ROLES.forEach(role => {
      const saved = rolePermissions.find(rp => rp.role === role.id);
      permsMap[role.id] = saved?.permissions || DEFAULT_PERMISSIONS[role.id];
    });
    setLocalPermissions(permsMap);
    setHasChanges(false);
  }, [rolePermissions]);

  const saveMutation = useMutation({
    mutationFn: async (roleId) => {
      const existing = rolePermissions.find(rp => rp.role === roleId);
      if (existing) {
        await base44.entities.RolePermissions.update(existing.id, {
          permissions: localPermissions[roleId]
        });
      } else {
        await base44.entities.RolePermissions.create({
          role: roleId,
          permissions: localPermissions[roleId]
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      toast.success("Permissions saved successfully");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Failed to save: " + error.message);
    }
  });

  const handlePermissionChange = (roleId, permKey, value) => {
    setLocalPermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permKey]: value
      }
    }));
    setHasChanges(true);
  };

  const handleResetToDefaults = (roleId) => {
    setLocalPermissions(prev => ({
      ...prev,
      [roleId]: DEFAULT_PERMISSIONS[roleId]
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(selectedRole);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return <AccessDenied message="Only administrators can manage role permissions." />;
  }

  const currentRolePerms = localPermissions[selectedRole] || DEFAULT_PERMISSIONS[selectedRole];
  const selectedRoleInfo = ROLES.find(r => r.id === selectedRole);

  return (
    <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
      <Toaster position="top-right" richColors />
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        {/* Header */}
        <div className="py-3 lg:py-4 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Role Permissions</h1>
            <p className="text-sm text-[#4B5563] mt-1">Configure what each role can do in the system</p>
          </div>
          <Button
            variant="outline"
            onClick={runBackfill}
            disabled={backfillRunning}
            className="gap-2"
          >
            {backfillRunning ? "Running..." : "Backfill Jobs → Projects"}
          </Button>
        </div>

        {/* Role Tabs */}
        <Tabs value={selectedRole} onValueChange={setSelectedRole} className="space-y-6">
          <TabsList className="w-full justify-start bg-white border border-[#E5E7EB] p-1 rounded-xl">
            {ROLES.map(role => (
              <TabsTrigger 
                key={role.id} 
                value={role.id}
                className="flex items-center gap-2 data-[state=active]:bg-[#FAE008] data-[state=active]:text-[#111827]"
              >
                <role.icon className="w-4 h-4" />
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLES.map(role => (
            <TabsContent key={role.id} value={role.id} className="space-y-6">
              {/* Role Header Card */}
              <Card className="border border-[#E5E7EB]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${role.color}`}>
                        <role.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-[#111827]">{role.label} Permissions</h2>
                        <p className="text-sm text-[#6B7280]">
                          {role.id === 'admin' && "Full access to all features"}
                          {role.id === 'manager' && "Can manage most features except critical deletions"}
                          {role.id === 'technician' && "Field work focused permissions"}
                          {role.id === 'viewer' && "Read-only access to data"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetToDefaults(role.id)}
                        className="gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset to Defaults
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || saveMutation.isPending}
                        className="gap-2 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
                      >
                        <Save className="w-4 h-4" />
                        {saveMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Permission Groups */}
              <div className="grid gap-4">
                {PERMISSION_GROUPS.map(group => (
                  <Card key={group.title} className="border border-[#E5E7EB]">
                    <CardHeader className="pb-3 border-b border-[#E5E7EB]">
                      <CardTitle className="flex items-center gap-2 text-[16px] font-semibold">
                        <group.icon className="w-5 h-5 text-[#FAE008]" />
                        {group.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.permissions.map(perm => (
                          <div 
                            key={perm.key} 
                            className="flex items-center justify-between p-3 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
                          >
                            <Label htmlFor={`${role.id}-${perm.key}`} className="cursor-pointer text-[14px]">
                              {perm.label}
                            </Label>
                            <Switch
                              id={`${role.id}-${perm.key}`}
                              checked={currentRolePerms[perm.key] || false}
                              onCheckedChange={(checked) => handlePermissionChange(role.id, perm.key, checked)}
                              disabled={role.id === 'admin'}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {role.id === 'admin' && (
                <div className="p-4 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl">
                  <p className="text-[14px] text-[#92400E]">
                    <strong>Note:</strong> Admin permissions cannot be modified. Admins always have full access to all features.
                  </p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}