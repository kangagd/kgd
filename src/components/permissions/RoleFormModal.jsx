import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, X, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { 
  getPermissionCategories, 
  createEmptyPermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_EDITOR_PERMISSIONS,
  DEFAULT_VIEWER_PERMISSIONS,
  DEFAULT_TECHNICIAN_PERMISSIONS
} from './permissionsUtils';

export default function RoleFormModal({ isOpen, onClose, role, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: createEmptyPermissions(),
    is_active: true
  });

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || '',
        description: role.description || '',
        permissions: role.permissions || createEmptyPermissions(),
        is_active: role.is_active !== false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        permissions: createEmptyPermissions(),
        is_active: true
      });
    }
  }, [role, isOpen]);

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

  const applyTemplate = (template) => {
    let permissions;
    switch (template) {
      case 'admin':
        permissions = { ...DEFAULT_ADMIN_PERMISSIONS };
        break;
      case 'editor':
        permissions = { ...DEFAULT_EDITOR_PERMISSIONS };
        break;
      case 'viewer':
        permissions = { ...DEFAULT_VIEWER_PERMISSIONS };
        break;
      case 'technician':
        permissions = { ...DEFAULT_TECHNICIAN_PERMISSIONS };
        break;
      default:
        permissions = createEmptyPermissions();
    }
    setFormData(prev => ({ ...prev, permissions }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const categories = getPermissionCategories();

  const actionLabels = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    reply: 'Reply',
    manage: 'Manage',
    upload: 'Upload'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FAE008]" />
            {role ? 'Edit Role' : 'Create New Role'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Manager, Scheduler"
                required
              />
            </div>
            <div className="space-y-2 flex items-end gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this role is for..."
              rows={2}
            />
          </div>

          {/* Permission Templates */}
          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => applyTemplate('admin')}>
                <ShieldCheck className="w-4 h-4 mr-1 text-green-600" />
                Full Access
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyTemplate('editor')}>
                <Shield className="w-4 h-4 mr-1 text-blue-600" />
                Editor
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyTemplate('viewer')}>
                <Shield className="w-4 h-4 mr-1 text-gray-600" />
                Viewer
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyTemplate('technician')}>
                <Shield className="w-4 h-4 mr-1 text-orange-600" />
                Technician
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyTemplate('none')}>
                <ShieldX className="w-4 h-4 mr-1 text-red-600" />
                No Access
              </Button>
            </div>
          </div>

          {/* Permissions Grid */}
          <div className="space-y-2">
            <Label>Permissions</Label>
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {categories.map(category => (
                    <div key={category.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2 border-b border-[#E5E7EB] last:border-0">
                      <div className="w-full sm:w-32 font-medium text-[14px] text-[#111827]">
                        {category.label}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-4">
                        {category.actions.map(action => (
                          <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                            <Switch
                              checked={formData.permissions[category.key]?.[action] === true}
                              onCheckedChange={(checked) => handlePermissionChange(category.key, action, checked)}
                              className="scale-75"
                            />
                            <span className="text-[13px] text-[#4B5563]">{actionLabels[action]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()} className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]">
              {isLoading ? 'Saving...' : 'Save Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}