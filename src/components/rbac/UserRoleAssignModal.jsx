import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Shield } from "lucide-react";

export default function UserRoleAssignModal({ open, onClose, user, roles, onSubmit, isSubmitting }) {
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    if (user) {
      setSelectedRoleId(user.custom_role_id || "default");
    }
  }, [user, open]);

  const handleSubmit = () => {
    onSubmit({
      userId: user.id,
      roleId: selectedRoleId === "default" ? null : selectedRoleId,
      roleName: selectedRoleId === "default" ? null : roles.find(r => r.id === selectedRoleId)?.name
    });
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-[#FAE008] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#111827]" />
              </div>
              <div>
                <p className="font-semibold text-[#111827]">{user.full_name}</p>
                <p className="text-sm text-[#4B5563]">{user.email}</p>
              </div>
            </div>

            {/* Current Role */}
            <div className="space-y-2">
              <Label className="text-sm text-[#4B5563]">Current Role</Label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline"
                  style={{ 
                    borderColor: user.custom_role_id ? selectedRole?.color : '#7C3AED',
                    color: user.custom_role_id ? selectedRole?.color : '#7C3AED'
                  }}
                >
                  {user.custom_role_name || (user.role === 'admin' ? 'Administrator' : user.is_field_technician ? 'Technician' : 'User')}
                </Badge>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Assign New Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span>Default (Based on system role)</span>
                    </div>
                  </SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: role.color || '#6B7280' }}
                        />
                        <span>{role.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Description */}
            {selectedRole && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                {selectedRole.description || "No description available."}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign Role
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}