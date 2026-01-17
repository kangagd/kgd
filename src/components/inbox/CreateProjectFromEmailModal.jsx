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
  const [step, setStep] = useState('review'); // 'review' or 'confirm'
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState(null);

  // Override fields
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editedAddress, setEditedAddress] = useState('');
  const [editedCustomerName, setEditedCustomerName] = useState('');

  // Generate preview on mount/open
  useEffect(() => {
    if (open && thread && emailMessage) {
      generatePreview();
    }
  }, [open, thread, emailMessage]);

  const generatePreview = async () => {
    setLoading(true);
    setPreviewError(null);
    try {
      // Call preview function to get AI suggestions
      const result = await base44.functions.invoke('previewProjectFromEmail', {
        email_thread_id: thread.id,
        email_message_id: emailMessage?.id || thread.id,
      });

      if (result.data?.error) {
        setPreviewError(result.data.error);
      } else {
        setPreview(result.data);
        setSelectedCategory(result.data?.suggested_category || '');
        setEditedAddress(result.data?.short_address || '');
        setEditedCustomerName(result.data?.customer_name || '');
      }
    } catch (err) {
      setPreviewError(err.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

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
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <DialogTitle className="text-[22px] font-semibold">
            {draftSubmitted ? 'Confirm Project Details' : 'Create Project from Email'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          {!draftSubmitted ? (
            // Draft Form - minimal, AI-filled fields highlighted
            <DraftProjectForm
              thread={thread}
              onConfirm={handleDraftSubmit}
              onCancel={onClose}
              isSubmitting={false}
            />
          ) : (
            // Full Form - confirm and edit before creating
            <ProjectForm
              initialData={{
                ...draftData,
                customer_id: "",
                customer_name: "",
                customer_email: "",
                customer_phone: "",
                status: "Lead"
              }}
              onSubmit={handleConfirmCreate}
              onCancel={handleDraftCancel}
              isSubmitting={createProjectMutation.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}