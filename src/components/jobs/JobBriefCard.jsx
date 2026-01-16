import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit2, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function JobBriefCard({ job, onJobUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(job.job_brief || '');
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('manageJob', { action: 'update', id: job.id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job brief updated');
      setIsEditing(false);
      onJobUpdated?.();
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateJobBrief', { job_id: job.id, mode: 'force' }),
    onSuccess: (res) => {
      if (res.data.success && !res.data.skipped) {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        toast.success('Job brief regenerated');
        onJobUpdated?.();
      }
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      job_brief: editText,
      job_brief_source: 'manual',
      job_brief_locked: true
    });
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate();
  };

  const isAi = job.job_brief_source === 'ai';
  const hasContent = job.job_brief && job.job_brief.trim();

  return (
    <div className="border border-[#E5E7EB] rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-[14px] font-semibold text-[#111827]">Job Brief</h4>
        <div className="flex items-center gap-2">
          {hasContent && (
            <>
              <Badge variant={isAi ? "secondary" : "outline"} className="text-[11px]">
                {isAi ? 'AI' : 'Manual'}
              </Badge>
              {isAi && job.job_brief_last_generated_at && (
                <span className="text-[11px] text-[#6B7280]">
                  Generated {format(parseISO(job.job_brief_last_generated_at), 'MMM d, H:mm')}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {!isEditing && hasContent && (
        <div className="space-y-3">
          <div className="text-[13px] text-[#4B5563] whitespace-pre-line leading-relaxed">
            {job.job_brief}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
              className="h-8"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={regenerateMutation.isPending}
                >
                  {regenerateMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Regenerate
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Regenerate Brief?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will replace your current Job Brief with a new AI-generated version. Continue?
                </AlertDialogDescription>
                <div className="flex gap-2 justify-end mt-4">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRegenerate}>
                    Regenerate
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {!isEditing && !hasContent && (
        <div className="text-[13px] text-[#6B7280] italic">No brief yet</div>
      )}

      {isEditing && (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-32 p-2.5 text-[13px] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#111827]"
            placeholder="Enter job brief..."
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              size="sm"
              className="h-8"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Save
            </Button>
            <Button
              onClick={() => {
                setIsEditing(false);
                setEditText(job.job_brief || '');
              }}
              variant="outline"
              size="sm"
              className="h-8"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}