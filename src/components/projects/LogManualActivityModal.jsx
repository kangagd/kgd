import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function LogManualActivityModal({ open, onClose, projectId, onSuccess }) {
  const [formData, setFormData] = useState({
    type: "Call",
    contact_name: "",
    summary: "",
    outcome: "",
    attachments: []
  });
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newAttachments = results.map((r, idx) => ({
        url: r.file_url,
        name: files[idx].name
      }));
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }));
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.summary.trim()) {
      toast.error('Summary is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await base44.auth.me();
      
      // Build content string with structured data
      let content = `**[${formData.type}]** ${formData.contact_name ? `with ${formData.contact_name}` : ''}\n\n${formData.summary}`;
      if (formData.outcome) {
        content += `\n\n**Outcome:** ${formData.outcome}`;
      }

      await base44.entities.ProjectMessage.create({
        project_id: projectId,
        sender_email: user.email,
        sender_name: user.full_name,
        content: content,
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
        message_type: 'manual_activity'
      });

      toast.success('Activity logged successfully');
      onSuccess?.();
      onClose();
      
      // Reset form
      setFormData({
        type: "Call",
        contact_name: "",
        summary: "",
        outcome: "",
        attachments: []
      });
    } catch (error) {
      toast.error('Failed to log activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log Manual Activity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="In-person">In-person</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Who (Contact Name)</Label>
            <Input
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="e.g., John Smith"
            />
          </div>

          <div>
            <Label>Summary *</Label>
            <Textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="What was discussed or done..."
              rows={4}
              required
            />
          </div>

          <div>
            <Label>Outcome (Optional)</Label>
            <Textarea
              value={formData.outcome}
              onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
              placeholder="What's the next step or result..."
              rows={3}
            />
          </div>

          <div>
            <Label>Attachments (Optional)</Label>
            <div className="space-y-2">
              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  {formData.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                      <span className="text-sm text-slate-700 truncate flex-1">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="ml-2 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('manual-activity-upload').click()}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
              <input
                id="manual-activity-upload"
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !formData.summary.trim()}>
            {isSubmitting ? 'Logging...' : 'Log Activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}