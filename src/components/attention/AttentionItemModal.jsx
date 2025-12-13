import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function AttentionItemModal({ 
  open, 
  onClose, 
  item = null, 
  entity_type, 
  entity_id, 
  onSave, 
  onDelete 
}) {
  const [formData, setFormData] = useState({
    category: item?.category || "Access & Site",
    audience: item?.audience || "both",
    severity: item?.severity || "high",
    title: item?.title || "",
    summary_bullets: item?.summary_bullets || ["", ""],
    evidence_type: item?.evidence_type || "",
    evidence_entity_id: item?.evidence_entity_id || "",
    evidence_excerpt: item?.evidence_excerpt || ""
  });

  const [errors, setErrors] = useState({});

  const handleBulletChange = (index, value) => {
    const newBullets = [...formData.summary_bullets];
    newBullets[index] = value;
    setFormData({ ...formData, summary_bullets: newBullets });
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title || formData.title.trim().length === 0) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 60) {
      newErrors.title = "Title must be 60 characters or less";
    }

    const filledBullets = formData.summary_bullets.filter(b => b && b.trim().length > 0);
    if (filledBullets.length === 0) {
      newErrors.bullets = "At least one bullet point is required";
    }

    if (formData.evidence_excerpt && formData.evidence_excerpt.length > 160) {
      newErrors.evidence = "Evidence excerpt must be 160 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    // Clean up empty bullets
    const cleanedBullets = formData.summary_bullets
      .filter(b => b && b.trim().length > 0)
      .slice(0, 2);

    const dataToSave = {
      ...formData,
      summary_bullets: cleanedBullets,
      entity_type,
      entity_id
    };

    // Remove empty optional fields
    if (!dataToSave.evidence_type) {
      delete dataToSave.evidence_type;
      delete dataToSave.evidence_entity_id;
      delete dataToSave.evidence_excerpt;
    }

    onSave(dataToSave);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Attention Item" : "Add Attention Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Category *</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Access & Site">Access & Site</SelectItem>
                <SelectItem value="Payments">Payments</SelectItem>
                <SelectItem value="Customer Risk">Customer Risk</SelectItem>
                <SelectItem value="Safety">Safety</SelectItem>
                <SelectItem value="Hard Blocker">Hard Blocker</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Audience *</Label>
              <Select value={formData.audience} onValueChange={(v) => setFormData({ ...formData, audience: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">Technician</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Severity *</Label>
              <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Title * (max 60 chars)</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={60}
              placeholder="Short, factual description"
            />
            {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
            <p className="text-xs text-gray-500 mt-1">{formData.title.length}/60</p>
          </div>

          <div>
            <Label>Summary Points * (max 2)</Label>
            <div className="space-y-2">
              <Input
                value={formData.summary_bullets[0] || ""}
                onChange={(e) => handleBulletChange(0, e.target.value)}
                placeholder="First bullet point"
              />
              <Input
                value={formData.summary_bullets[1] || ""}
                onChange={(e) => handleBulletChange(1, e.target.value)}
                placeholder="Second bullet point (optional)"
              />
            </div>
            {errors.bullets && <p className="text-red-600 text-xs mt-1">{errors.bullets}</p>}
          </div>

          <div className="border-t pt-4">
            <Label className="text-gray-600">Evidence (optional)</Label>
            
            <div className="mt-2 space-y-3">
              <Select value={formData.evidence_type} onValueChange={(v) => setFormData({ ...formData, evidence_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Evidence type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  <SelectItem value="job_field">Job Field</SelectItem>
                  <SelectItem value="project_field">Project Field</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="call_note">Call Note</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                </SelectContent>
              </Select>

              {formData.evidence_type && (
                <>
                  <Input
                    value={formData.evidence_entity_id}
                    onChange={(e) => setFormData({ ...formData, evidence_entity_id: e.target.value })}
                    placeholder="Evidence entity ID (optional)"
                  />
                  <Textarea
                    value={formData.evidence_excerpt}
                    onChange={(e) => setFormData({ ...formData, evidence_excerpt: e.target.value })}
                    placeholder="Evidence excerpt (max 160 chars)"
                    maxLength={160}
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">{formData.evidence_excerpt.length}/160</p>
                </>
              )}
            </div>
            {errors.evidence && <p className="text-red-600 text-xs mt-1">{errors.evidence}</p>}
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {item && onDelete && (
              <Button variant="destructive" onClick={() => onDelete(item.id)}>
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}