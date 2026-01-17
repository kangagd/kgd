import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";

const CATEGORIES = [
  'Sectional Door Repair',
  'Sectional Door Install',
  'Roller Shutter Repair',
  'Roller Shutter Install',
  'Custom Door Repair',
  'Custom Door Install',
  'Maintenance Service',
  'General Enquiry',
];

export default function CreateProjectFromEmailModal({ open, onClose, thread, emailMessage, onSuccess }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('createProjectFromEmail', {
        email_thread_id: thread.id,
        email_message_id: emailMessage?.id || thread.id,
        selected_category_override: selectedCategory || undefined,
      });

      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: async (result) => {
      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: inboxKeys?.threads?.() });
      queryClient.invalidateQueries({ queryKey: ['project', result.projectId] });

      toast.success(`Project created: ${result.projectTitle}`);
      if (onSuccess) onSuccess(result.projectId, result.projectTitle);
      
      onClose();

      // Navigate to project
      navigate(`${createPageUrl("Projects")}?projectId=${result.projectId}`);
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  const handleCreate = () => {
    createProjectMutation.mutate();
  };

  if (!thread) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle>Create Project from Email</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Analyzing email...</span>
          </div>
        ) : previewError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {previewError}
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* Customer Name */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">
                Customer Name
              </label>
              <Input
                value={editedCustomerName}
                onChange={(e) => setEditedCustomerName(e.target.value)}
                placeholder="Customer name"
              />
              <p className="text-xs text-slate-500 mt-1">
                Extracted from: {preview.customer_email}
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">
                Project Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Confidence: {preview.category_confidence}
              </p>
            </div>

            {/* Address */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">
                Project Address
              </label>
              <Input
                value={editedAddress}
                onChange={(e) => setEditedAddress(e.target.value)}
                placeholder="Address"
              />
            </div>

            {/* Project Name Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-600 font-semibold mb-1">Project Name Preview</p>
              <p className="text-sm font-semibold text-slate-900">
                {selectedCategory} - {editedAddress}
              </p>
            </div>

            {/* Description Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-xs text-slate-600 font-semibold mb-2">Description (from email)</p>
              <div className="text-xs text-slate-700 space-y-1">
                {preview.description_bullets?.map((bullet, idx) => (
                  <div key={idx}>• {bullet}</div>
                )) || <div>No description extracted</div>}
              </div>
            </div>

            {/* Attachments Info */}
            {preview.attachment_count > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  ✓ {preview.attachment_count} attachment(s) will be attached to the project
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !preview || createProjectMutation.isPending}
            className="bg-slate-900 text-white hover:bg-slate-800 gap-2"
          >
            {createProjectMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Project
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}