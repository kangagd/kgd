import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Shield } from 'lucide-react';

export default function AssignRoleModal({ isOpen, onClose, user, roles, onSave, isLoading }) {
  const [selectedRoleId, setSelectedRoleId] = useState('');

  useEffect(() => {
    if (user) {
      setSelectedRoleId(user.custom_role_id || '');
    }
  }, [user, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    onSave({
      custom_role_id: selectedRoleId || null,
      custom_role_name: selectedRole?.name || null
    });
  };

  const activeRoles = roles.filter(r => r.is_active !== false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FAE008]" />
            Assign Role
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg">
            <div className="w-10 h-10 bg-[#E5E7EB] rounded-full flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-[#6B7280]" />
            </div>
            <div>
              <p className="font-medium text-[#111827]">{user?.full_name || 'User'}</p>
              <p className="text-[13px] text-[#6B7280]">{user?.email}</p>
            </div>
            {user?.role === 'admin' && (
              <Badge className="ml-auto bg-green-100 text-green-800">System Admin</Badge>
            )}
          </div>

          {user?.role === 'admin' ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-[13px] text-blue-700">
                System admins always have full access. Custom roles only apply to non-admin users.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="role">Select Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>
                    <span className="text-[#6B7280]">No custom role (default permissions)</span>
                  </SelectItem>
                  {activeRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#FAE008]" />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRoleId && (
                <p className="text-[12px] text-[#6B7280]">
                  {roles.find(r => r.id === selectedRoleId)?.description || 'No description'}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || user?.role === 'admin'} 
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              {isLoading ? 'Saving...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}