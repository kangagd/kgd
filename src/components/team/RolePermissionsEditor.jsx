import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Save, RotateCcw } from "lucide-react";
import { getDefaultPermissions, ROLE_DEFAULTS } from "../common/usePermissions";

const PERMISSION_LABELS = {
  jobs: { label: "Jobs", actions: ["view", "create", "edit", "delete"] },
  projects: { label: "Projects", actions: ["view", "create", "edit", "delete"] },
  customers: { label: "Customers", actions: ["view", "create", "edit", "delete"] },
  invoicing: { label: "Invoicing", actions: ["view", "create", "edit", "take_payment"] },
  price_list: { label: "Price List", actions: ["view", "edit"] },
  inbox: { label: "Inbox", actions: ["view", "reply"] },
  reports: { label: "Reports", isBoolean: true },
  team_management: { label: "Team Management", isBoolean: true },
  settings: { label: "Settings", isBoolean: true }
};

const ACTION_LABELS = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  take_payment: "Take Payment",
  reply: "Reply"
};

const ROLE_LABELS = {
  administrator: { label: "Administrator", color: "bg-red-100 text-red-700" },
  manager: { label: "Manager", color: "bg-blue-100 text-blue-700" },
  office_staff: { label: "Office Staff", color: "bg-purple-100 text-purple-700" },
  technician: { label: "Technician", color: "bg-green-100 text-green-700" }
};

export default function RolePermissionsEditor({ user, onSave, isSaving }) {
  const [selectedRole, setSelectedRole] = useState(user?.user_role || 'technician');
  const [permissions, setPermissions] = useState(user?.permissions || getDefaultPermissions(selectedRole));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user?.permissions) {
      setPermissions(user.permissions);
    } else {
      setPermissions(getDefaultPermissions(selectedRole));
    }
    setSelectedRole(user?.user_role || 'technician');
  }, [user]);

  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    setPermissions(getDefaultPermissions(newRole));
    setHasChanges(true);
  };

  const handlePermissionChange = (resource, action, value) => {
    setPermissions(prev => {
      const updated = { ...prev };
      if (typeof updated[resource] === 'boolean') {
        updated[resource] = value;
      } else {
        updated[resource] = { ...updated[resource], [action]: value };
      }
      return updated;
    });
    setHasChanges(true);
  };

  const handleResetToDefaults = () => {
    setPermissions(getDefaultPermissions(selectedRole));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave({
      user_role: selectedRole,
      permissions
    });
    setHasChanges(false);
  };

  const getPermissionValue = (resource, action) => {
    const resourcePerms = permissions[resource];
    if (typeof resourcePerms === 'boolean') {
      return resourcePerms;
    }
    return resourcePerms?.[action] ?? false;
  };

  return (
    <Card className="border border-[#E5E7EB]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#FAE008]" />
          Role & Permissions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>User Role</Label>
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#6B7280]">
            Changing the role will reset permissions to that role's defaults
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#111827]">Custom Permissions</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToDefaults}
              className="text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset to Defaults
            </Button>
          </div>

          {Object.entries(PERMISSION_LABELS).map(([resource, config]) => (
            <div key={resource} className="space-y-2">
              <Label className="text-sm font-medium">{config.label}</Label>
              {config.isBoolean ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getPermissionValue(resource)}
                    onCheckedChange={(val) => handlePermissionChange(resource, null, val)}
                  />
                  <span className="text-sm text-[#6B7280]">
                    {getPermissionValue(resource) ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {config.actions.map(action => (
                    <div key={action} className="flex items-center gap-2 bg-[#F9FAFB] rounded-lg p-2">
                      <Switch
                        id={`${resource}-${action}`}
                        checked={getPermissionValue(resource, action)}
                        onCheckedChange={(val) => handlePermissionChange(resource, action, val)}
                        className="scale-75"
                      />
                      <Label 
                        htmlFor={`${resource}-${action}`} 
                        className="text-xs cursor-pointer"
                      >
                        {ACTION_LABELS[action] || action}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {hasChanges && (
          <div className="pt-4 border-t border-[#E5E7EB]">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Permissions'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ROLE_LABELS, PERMISSION_LABELS };