import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, Mail, Phone, Search, Filter, Edit2, 
  Shield, ShieldCheck, Eye, Wrench, MoreHorizontal 
} from "lucide-react";
import { toast } from "sonner";
import UserEditModal from "@/components/team/UserEditModal";
import AccessDenied from "@/components/common/AccessDenied";
import { RoleBadge } from "@/components/common/PermissionsContext";

export default function Team() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadCurrentUser();
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getTeamMembers');
      return response.data?.users || [];
    },
    enabled: currentUser?.role === 'admin' || currentUser?.extended_role === 'manager',
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("User updated successfully");
      setIsEditModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error("Failed to update user: " + error.message);
    }
  });

  // Check if current user has access
  if (currentUser && currentUser.role !== 'admin' && currentUser.extended_role !== 'manager') {
    return <AccessDenied message="Only administrators and managers can access the Team page." />;
  }

  // Loading state
  if (!currentUser || isLoading) {
    return (
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Get effective role for display
  const getEffectiveRole = (user) => {
    // Use extended_role if set, otherwise fallback to built-in role logic
    if (user.extended_role) return user.extended_role;
    if (user.role === 'admin') return 'admin';
    if (user.role === 'manager') return 'manager';
    if (user.is_field_technician) return 'technician';
    if (user.role === 'viewer') return 'viewer';
    return 'user';
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    // Exclude inactive Base44 platform staff accounts
    if (user.email?.endsWith('@base44.com') && (user.status === 'inactive' || !user.status)) {
      return false;
    }

    const matchesSearch = 
      (user.display_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const effectiveRole = getEffectiveRole(user);
    const matchesRole = roleFilter === "all" || effectiveRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = (userId, data) => {
    updateUserMutation.mutate({ userId, data });
  };

  // Stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => getEffectiveRole(u) === 'admin').length;
  const managerCount = users.filter(u => getEffectiveRole(u) === 'manager').length;
  const technicianCount = users.filter(u => getEffectiveRole(u) === 'technician').length;
  const activeCount = users.filter(u => (u.status || 'active') === 'active').length;

  return (
    <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="py-3 lg:py-4 mb-6">
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">Team Management</h1>
          <p className="text-sm text-[#4B5563] mt-1">Manage team members and their roles</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="text-[24px] font-bold text-[#111827]">{totalUsers}</div>
              <div className="text-[13px] text-[#6B7280]">Total Users</div>
            </CardContent>
          </Card>
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="text-[24px] font-bold text-purple-600">{adminCount}</div>
              <div className="text-[13px] text-[#6B7280]">Admins</div>
            </CardContent>
          </Card>
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="text-[24px] font-bold text-blue-600">{managerCount}</div>
              <div className="text-[13px] text-[#6B7280]">Managers</div>
            </CardContent>
          </Card>
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="text-[24px] font-bold text-[#D97706]">{technicianCount}</div>
              <div className="text-[13px] text-[#6B7280]">Technicians</div>
            </CardContent>
          </Card>
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="text-[24px] font-bold text-green-600">{activeCount}</div>
              <div className="text-[13px] text-[#6B7280]">Active</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border border-[#E5E7EB] mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-3">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="w-4 h-4 mr-2 text-[#9CA3AF]" />
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>

              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-[#E5E7EB] bg-[#F9FAFB] p-5">
            <CardTitle className="flex items-center gap-3 text-[18px] font-semibold text-[#111827]">
              <Users className="w-5 h-5 text-[#FAE008]" />
              Team Members ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-[#6B7280]">
                <Users className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
                <p className="font-medium">No users found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {/* Table Header - Desktop */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-[#F9FAFB] text-[13px] font-medium text-[#6B7280]">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {filteredUsers.map((user) => {
                  const effectiveRole = getEffectiveRole(user);
                  return (
                    <div 
                      key={user.id} 
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 md:px-5 md:py-4 hover:bg-[#F9FAFB] transition-colors items-center"
                    >
                      {/* Name & Email */}
                      <div className="md:col-span-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FAE008]/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#111827] font-semibold">
                              {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-[#111827] truncate">{user.display_name || user.full_name || 'Unnamed User'}</h3>
                            <p className="text-[13px] text-[#6B7280] truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="md:col-span-2 flex items-center gap-2 md:gap-0">
                        <span className="md:hidden text-[12px] text-[#9CA3AF]">Role:</span>
                        <RoleBadge role={effectiveRole} />
                      </div>

                      {/* Type */}
                      <div className="md:col-span-2 flex items-center gap-2 md:gap-0">
                        <span className="md:hidden text-[12px] text-[#9CA3AF]">Type:</span>
                        {user.is_field_technician ? (
                          <Badge className="bg-[#FAE008]/20 text-[#92400E] gap-1">
                            <Wrench className="w-3 h-3" />
                            Field Tech
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Eye className="w-3 h-3" />
                            Office
                          </Badge>
                        )}
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2 flex items-center gap-2 md:gap-0">
                        <span className="md:hidden text-[12px] text-[#9CA3AF]">Status:</span>
                        <Badge variant={(user.status && user.status !== '' ? user.status : 'active') === 'active' ? 'success' : 'secondary'}>
                          {user.status && user.status !== '' ? user.status : 'active'}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="gap-2 text-[#4B5563] hover:text-[#111827]"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="md:hidden">Edit</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Note */}
        <div className="mt-6 p-4 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl">
          <p className="text-[14px] text-[#92400E] leading-relaxed">
            <strong className="font-semibold">Note:</strong> To invite new team members, use the user management section in your dashboard settings.
          </p>
        </div>
      </div>

      {/* Edit Modal */}
      <UserEditModal
        user={selectedUser}
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
        isSaving={updateUserMutation.isPending}
      />
    </div>
  );
}