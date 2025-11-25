import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Mail, Phone, Briefcase, Shield, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import RolePermissionsEditor, { ROLE_LABELS } from "../components/team/RolePermissionsEditor";
import { usePermissions } from "../components/common/usePermissions";

export default function Team() {
  const [selectedUser, setSelectedUser] = useState(null);
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User permissions updated');
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error('Failed to update permissions');
      console.error(error);
    }
  });

  const handleSavePermissions = (permData) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: permData
    });
  };

  const technicians = users.filter(u => u.is_field_technician || u.user_role === 'technician');
  const admins = users.filter(u => u.role === 'admin' || u.user_role === 'administrator');
  const managers = users.filter(u => u.user_role === 'manager');
  const officeStaff = users.filter(u => u.user_role === 'office_staff');

  const getRoleBadge = (user) => {
    if (user.role === 'admin') {
      return <Badge className="bg-red-100 text-red-700 border-0">Admin</Badge>;
    }
    const role = user.user_role || 'technician';
    const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.technician;
    return <Badge className={`${roleInfo.color} border-0`}>{roleInfo.label}</Badge>;
  };

  return (
    <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="py-3 lg:py-4 mb-4 lg:mb-6">
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">Team</h1>
          <p className="text-sm text-[#4B5563] mt-1">Manage your team members</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-2 border-[hsl(32,15%,88%)] shadow-lg rounded-2xl">
            <CardHeader className="border-b-2 border-[hsl(32,15%,88%)] bg-gradient-to-r from-[hsl(32,25%,96%)] to-white p-6">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-[hsl(25,10%,12%)] tracking-tight">
                <Users className="w-6 h-6 text-[#fae008]" />
                Field Technicians ({technicians.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {technicians.length === 0 ? (
                <div className="p-12 text-center text-[hsl(25,8%,45%)]">
                  <Users className="w-12 h-12 mx-auto text-[hsl(32,15%,88%)] mb-3" />
                  <p className="font-medium">No field technicians yet</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-[hsl(32,15%,88%)]">
                  {technicians.map((tech) => (
                    <div key={tech.id} className="p-5 hover:bg-[hsl(32,25%,96%)] transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-[hsl(25,10%,12%)]">{tech.full_name}</h3>
                          {tech.job_title && (
                            <p className="text-sm text-[hsl(25,8%,45%)] mt-1">{tech.job_title}</p>
                          )}
                        </div>
{getRoleBadge(tech)}
                      </div>
                      <div className="space-y-2 text-sm text-[hsl(25,10%,25%)]">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                          <a href={`mailto:${tech.email}`} className="hover:text-[#fae008] font-medium transition-colors">
                            {tech.email}
                          </a>
                        </div>
                        {tech.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                            <a href={`tel:${tech.phone}`} className="hover:text-[#fae008] font-medium transition-colors">
                              {tech.phone}
                            </a>
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUser(tech)}
                          className="mt-2 text-xs text-[#6B7280] hover:text-[#111827]"
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Manage Permissions
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-[hsl(32,15%,88%)] shadow-lg rounded-2xl">
            <CardHeader className="border-b-2 border-[hsl(32,15%,88%)] bg-gradient-to-r from-[hsl(32,25%,96%)] to-white p-6">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-[hsl(25,10%,12%)] tracking-tight">
                <Briefcase className="w-6 h-6 text-purple-600" />
                Administrators ({admins.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {admins.length === 0 ? (
                <div className="p-12 text-center text-[hsl(25,8%,45%)]">
                  <Briefcase className="w-12 h-12 mx-auto text-[hsl(32,15%,88%)] mb-3" />
                  <p className="font-medium">No administrators</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-[hsl(32,15%,88%)]">
                  {admins.map((admin) => (
                    <div key={admin.id} className="p-5 hover:bg-[hsl(32,25%,96%)] transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-[hsl(25,10%,12%)]">{admin.full_name}</h3>
                          {admin.job_title && (
                            <p className="text-sm text-[hsl(25,8%,45%)] mt-1">{admin.job_title}</p>
                          )}
                        </div>
{getRoleBadge(admin)}
                      </div>
                      <div className="space-y-2 text-sm text-[hsl(25,10%,25%)]">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                          <a href={`mailto:${admin.email}`} className="hover:text-[#fae008] font-medium transition-colors">
                            {admin.email}
                          </a>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[hsl(25,8%,55%)]" />
                            <a href={`tel:${admin.phone}`} className="hover:text-[#fae008] font-medium transition-colors">
                              {admin.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
          <p className="text-sm text-[hsl(25,10%,12%)] leading-relaxed">
            <strong className="font-bold">Note:</strong> To add or manage team members, use the user management section in your dashboard settings. 
            Mark users as field technicians by updating their profile.
          </p>
        </div>

        {/* Permissions Editor Modal */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#FAE008]" />
                Edit Permissions: {selectedUser?.full_name}
              </DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <RolePermissionsEditor
                user={selectedUser}
                onSave={handleSavePermissions}
                isSaving={updateUserMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}