import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { v4 as uuidv4 } from 'uuid';

export default function CreateAttentionFlagModal({ 
  entity, 
  entityType, 
  onClose, 
  onSuccess 
}) {
  const [formData, setFormData] = useState({
    type: "internal_warning",
    label: "",
    details: "",
    severity: "warning",
    pinned: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.label.trim()) return;

    setIsSubmitting(true);
    try {
      const user = await base44.auth.me();
      
      const newFlag = {
        id: uuidv4(),
        ...formData,
        created_by: user.email,
        created_at: new Date().toISOString(),
        acknowledged: false,
        resolved: false
      };

      const existingFlags = entity.attention_flags || [];
      const updated = {
        ...entity,
        attention_flags: [...existingFlags, newFlag]
      };

      await base44.entities[entityType].update(entity.id, updated);
      
      // Log to change history
      await base44.entities.ChangeHistory.create({
        [`${entityType.toLowerCase()}_id`]: entity.id,
        field_name: 'attention_flags',
        old_value: '',
        new_value: `Added flag: ${formData.label}`,
        changed_by: user.email,
        changed_by_name: user.full_name
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create flag:', error);
      alert('Failed to create attention flag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Attention Flag</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_risk">Client Risk</SelectItem>
                <SelectItem value="site_constraint">Site Constraint</SelectItem>
                <SelectItem value="payment_hold">Payment Hold</SelectItem>
                <SelectItem value="access_issue">Access Issue</SelectItem>
                <SelectItem value="technical_risk">Technical Risk</SelectItem>
                <SelectItem value="logistics_dependency">Logistics Dependency</SelectItem>
                <SelectItem value="vip_client">VIP Client</SelectItem>
                <SelectItem value="internal_warning">Internal Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Label (short summary)</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Unpaid invoice blocking work"
              required
            />
          </div>

          <div>
            <Label>Details (optional, internal only)</Label>
            <Textarea
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              placeholder="Additional context for the team..."
              rows={3}
            />
          </div>

          <div>
            <Label>Severity</Label>
            <Select
              value={formData.severity}
              onValueChange={(value) => setFormData({ ...formData, severity: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Pin to top</Label>
            <Switch
              checked={formData.pinned}
              onCheckedChange={(checked) => setFormData({ ...formData, pinned: checked })}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.label.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Flag'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Polyfill for uuid in browser
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}