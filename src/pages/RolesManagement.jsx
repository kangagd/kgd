import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Plus, 
  Pencil, 
  Trash2, 
  Users, 
  Search,
  ShieldCheck,
  UserCircle,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import RoleFormModal from '@/components/permissions/RoleFormModal';
import AssignRoleModal from '@/components/permissions/AssignRoleModal';
import { getPermissionCategories } from '@/components/permissions/permissionsUtils';

export default function RolesManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('roles');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list('-created_date')
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (data) => base44.entities.Role.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowRoleModal(false);
      setSelectedRole(null);
      toast.success('Role created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create role: ' + error.message);
    }
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Role.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowRoleModal(false);
      setSelectedRole(null);
      toast.success('Role updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + error.message);
    }
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (id) => base44.entities.Role.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteConfirm(null);
      toast.success('Role deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete role: ' + error.message);
    }
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAssignModal(false);
      setSelectedUser(null);
      toast.success('User role updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update user role: ' + error.message);
    }
  });

  const handleSaveRole = (data) => {
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data });
    } else {
      createRoleMutation.mutate(data);
    }
  };

  const handleAssignRole = (data) => {
    updateUserRoleMutation.mutate({ userId: selectedUser.id, data });
  };

  const handleEditRole = (role) => {
    setSelectedRole(role);
    setShowRoleModal(true);
  };

  const handleDeleteRole = (role) => {
    // Check if any users have this role
    const usersWithRole = users.filter(u => u.custom_role_id === role.id);
    if (usersWithRole.length > 0) {
      toast.error(`Cannot delete role. ${usersWithRole.length} user(s) are assigned to this role.`);
      return;
    }
    setDeleteConfirm(role);
  };

  const handleAssignUser = (user) => {
    setSelectedUser(user);
    setShowAssignModal(true);
  };

  const filteredRoles = roles.filter(role => 
    role.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = getPermissionCategories();

  const countPermissions = (permissions) => {
    if (!permissions) return { granted: 0, total: 0 };
    let granted = 0;
    let total = 0;
    categories.forEach(cat => {
      cat.actions.forEach(action => {
        total++;
        if (permissions[cat.key]?.[action]) granted++;
      });
    });
    return { granted, total };
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#111827] flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#FAE008]" />
            Roles & Permissions
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Manage user roles and access permissions
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedRole(null);
            setShowRoleModal(true);
          }}
          className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users ({users.length})
          </TabsTrigger>
        </TabsList>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder={activeTab === 'roles' ? 'Search roles...' : 'Search users...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Roles Tab */}
        <TabsContent value="roles">
          {rolesLoading ? (
            <div className="text-center py-8 text-[#6B7280]">Loading roles...</div>
          ) : filteredRoles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-[#6B7280]">
                  {searchTerm ? 'No roles match your search' : 'No roles created yet'}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setShowRoleModal(true)}
                    variant="outline"
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create your first role
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRoles.map(role => {
                const permCount = countPermissions(role.permissions);
                const usersWithRole = users.filter(u => u.custom_role_id === role.id);
                
                return (
                  <Card key={role.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-[#FAE008]/20 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#111827]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-[#111827]">{role.name}</h3>
                              {role.is_system_role && (
                                <Badge variant="secondary">System</Badge>
                              )}
                              {!role.is_active && (
                                <Badge variant="outline" className="text-red-600 border-red-200">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-[13px] text-[#6B7280] mt-0.5">
                              {role.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-[12px] text-[#6B7280]">
                                <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                                {permCount.granted}/{permCount.total} permissions
                              </span>
                              <span className="text-[12px] text-[#6B7280]">
                                <Users className="w-3.5 h-3.5 inline mr-1" />
                                {usersWithRole.length} user{usersWithRole.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRole(role)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                            {!role.is_system_role && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteRole(role)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Role
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          {usersLoading ? (
            <div className="text-center py-8 text-[#6B7280]">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-[#6B7280]">No users match your search</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.map(user => {
                const userRole = roles.find(r => r.id === user.custom_role_id);
                
                return (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#E5E7EB] rounded-full flex items-center justify-center">
                            <span className="font-semibold text-[#111827]">
                              {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-[#111827]">{user.full_name || 'Unnamed User'}</h3>
                              {user.role === 'admin' && (
                                <Badge className="bg-green-100 text-green-800">Admin</Badge>
                              )}
                              {user.is_field_technician && (
                                <Badge variant="outline">Technician</Badge>
                              )}
                            </div>
                            <p className="text-[13px] text-[#6B7280]">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {user.role === 'admin' ? (
                              <span className="text-[13px] text-green-700 font-medium">Full Access</span>
                            ) : userRole ? (
                              <div className="flex items-center gap-1.5">
                                <Shield className="w-4 h-4 text-[#FAE008]" />
                                <span className="text-[13px] font-medium text-[#111827]">{userRole.name}</span>
                              </div>
                            ) : (
                              <span className="text-[13px] text-[#6B7280]">Default permissions</span>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAssignUser(user)}
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Assign Role
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Role Form Modal */}
      <RoleFormModal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false);
          setSelectedRole(null);
        }}
        role={selectedRole}
        onSave={handleSaveRole}
        isLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
      />

      {/* Assign Role Modal */}
      <AssignRoleModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        roles={roles}
        onSave={handleAssignRole}
        isLoading={updateUserRoleMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRoleMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}