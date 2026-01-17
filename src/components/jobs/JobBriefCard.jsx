import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Edit2, RefreshCw, Loader2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function JobBriefCard({ job }) {
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [briefText, setBriefText] = useState(job.job_brief || '');
  const didAutoBriefRef = useRef(false);
  const queryClient = useQueryClient();

  const saveBriefMutation = useMutation({
    mutationFn: async (briefData) => {
      return await base44.entities.Job.update(job.id, briefData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      toast.success('Job brief saved');
      setIsEditingBrief(false);
    }
  });

  const generateBriefMutation = useMutation({
    mutationFn: async ({ mode }) => {
      const response = await base44.functions.invoke('generateJobBrief', {
        job_id: job.id,
        mode
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info(`Job brief not generated: ${data.reason}`);
      } else {
        setBriefText(data.job_brief);
        queryClient.invalidateQueries({ queryKey: ['job', job.id] });
        toast.success('Job brief generated');
      }
    },
    onError: (error) => {
      toast.error('Failed to generate job brief');
    }
  });

  // Auto-generate brief on mount (only once)
  useEffect(() => {
    if (!didAutoBriefRef.current && job.id && !isEditingBrief) {
      didAutoBriefRef.current = true;
      generateBriefMutation.mutate({ mode: 'auto' });
    }
  }, [job.id]);

  // Update local state when job changes
  useEffect(() => {
    setBriefText(job.job_brief || '');
  }, [job.job_brief]);

  const handleSaveBrief = () => {
    saveBriefMutation.mutate({
      job_brief: briefText,
      job_brief_source: 'manual',
      job_brief_locked: true
    });
  };

  const handleRegenerateBrief = () => {
    generateBriefMutation.mutate({ mode: 'force' });
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#6B7280]" />
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Job Brief</CardTitle>
            {job.job_brief_source === 'manual' && (
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                Manual
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isEditingBrief && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsEditingBrief(true)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={generateBriefMutation.isPending}
                    >
                      {generateBriefMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerate Job Brief?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will replace your current Job Brief with a new AI-generated version. Continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRegenerateBrief}>
                        Regenerate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditingBrief ? (
          <div className="space-y-3">
            <Textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Enter job brief..."
              className="min-h-[150px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveBrief}
                disabled={saveBriefMutation.isPending}
                size="sm"
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsEditingBrief(false);
                  setBriefText(job.job_brief || '');
                }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-[14px] text-[#111827] whitespace-pre-wrap">
            {briefText || (
              <div className="text-center py-6 text-[#9CA3AF]">
                {generateBriefMutation.isPending ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating brief...</span>
                  </div>
                ) : (
                  'No job brief yet. Click the edit button to add one or wait for auto-generation.'
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}