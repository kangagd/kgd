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

  const handleCreate = async () => {
    if (!thread) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      // Fetch messages if we don't have one
      let messageId = emailMessage?.id;
      if (!messageId) {
        const messages = await base44.entities.EmailMessage.filter({ thread_id: thread.id });
        if (messages.length === 0) {
          throw new Error('No messages found in this thread');
        }
        // Use the most recent message
        messageId = messages[messages.length - 1].id;
      }

      const response = await base44.functions.invoke('createProjectFromEmail', {
        email_thread_id: thread.id,
        email_message_id: messageId,
      });

      if (response.data?.error) throw new Error(response.data.error);

      const result = response.data;
      
      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['project', result.projectId] });

      toast.success(`Project created: ${result.projectTitle}`);
      if (onSuccess) onSuccess(result.projectId);
      
      onClose();
      navigate(`${createPageUrl("Projects")}?projectId=${result.projectId}`);
    } catch (err) {
      setError(err.message || 'Failed to create project');
      toast.error(err.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  if (!thread) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle>Create Project from Email</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {isCreating 
              ? 'Creating project and extracting email details...' 
              : 'This will create a new project and link it to this email thread.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="bg-slate-900 text-white hover:bg-slate-800 gap-2"
          >
            {isCreating ? (
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