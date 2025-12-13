import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateAttentionItemModal({ entityType, entityId, onClose }) {
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    severity: "important",
    audience: "both"
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AttentionItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems'] });
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      entity_type: entityType,
      entity_id: entityId,
      title: formData.title,
      body: formData.body || null,
      severity: formData.severity,
      audience: formData.audience,
      source: "manual",
      status: "active"
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Attention Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief title"
              required
            />
          </div>

          <div>
            <Label>Details (Optional)</Label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Additional context (2-3 lines max)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Severity</Label>
              <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Audience</Label>
              <Select value={formData.audience} onValueChange={(value) => setFormData({ ...formData, audience: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Everyone</SelectItem>
                  <SelectItem value="office">Office Only</SelectItem>
                  <SelectItem value="tech">Technicians Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              disabled={createMutation.isPending || !formData.title}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}