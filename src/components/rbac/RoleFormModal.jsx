import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSION_CATEGORIES, DEFAULT_PERMISSIONS, ROLE_TEMPLATES } from "./permissionsConfig";
import { Loader2, Copy } from "lucide-react";

export default function RoleFormModal({ open, onClose, role, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#6B7280",
    permissions: {}
  });

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || "",
        description: role.description || "",
        color: role.color || "#6B7280",
        permissions: role.permissions || {}
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "#6B7280",
        permissions: {}
      });
    }
  }, [role, open]);

  const handlePermissionChange = (category, action, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: {
          ...prev.permissions[category],
          [action]: value
        }
      }
    }));
  };

  const applyTemplate = (templateKey) => {
    const template = ROLE_TEMPLATES.find(t => t.key === templateKey);
    const permissions = DEFAULT_PERMISSIONS[templateKey];
    
    if (template && permissions) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || template.name,
        description: prev.description || template.description,
        color: template.color,
        permissions: { ...permissions }
      }));
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const getPermissionValue = (category, action) => {
    return formData.permissions?.[category]?.[action] === true;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Create New Role"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Senior Technician"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this role is for..."
              rows={2}
            />
          </div>

          {/* Template Selection */}
          {!role && (
            <div className="space-y-2">
              <Label>Start from a template</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_TEMPLATES.map((template) => (
                  <Button
                    key={template.key}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template.key)}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-3 h-3" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Permissions</Label>
            <Tabs defaultValue={PERMISSION_CATEGORIES[0].key} className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 justify-start bg-transparent p-0">
                {PERMISSION_CATEGORIES.map((cat) => (
                  <TabsTrigger
                    key={cat.key}
                    value={cat.key}
                    className="data-[state=active]:bg-[#FAE008] data-[state=active]:text-[#111827]"
                  >
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {PERMISSION_CATEGORIES.map((cat) => (
                <TabsContent key={cat.key} value={cat.key} className="mt-4">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">{cat.label} Permissions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {cat.permissions.map((perm) => (
                        <div key={perm.key} className="flex items-center justify-between">
                          <Label className="font-normal cursor-pointer">{perm.label}</Label>
                          <Switch
                            checked={getPermissionValue(cat.key, perm.key)}
                            onCheckedChange={(checked) => handlePermissionChange(cat.key, perm.key, checked)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name || isSubmitting}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {role ? "Update Role" : "Create Role"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}