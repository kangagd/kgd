import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Edit, Save, X, RefreshCw, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function JobBriefCard({ job, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBrief, setEditedBrief] = useState(job.job_brief || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const didAutoBriefRef = useRef(false);
  const textareaRef = useRef(null);

  // Auto-generate on mount if needed
  useEffect(() => {
    const autoGenerate = async () => {
      // Only run once per component mount
      if (didAutoBriefRef.current) return;
      didAutoBriefRef.current = true;

      // Don't auto-generate if user is editing
      if (isEditing) return;

      try {
        const response = await base44.functions.invoke('generateJobBrief', {
          job_id: job.id,
          mode: 'auto'
        });

        if (response.data.success) {
          onRefresh();
          toast.success('Job brief generated');
        } else if (response.data.skipped) {
          // Silently skip - no need to notify user
          console.log(`[JobBrief] Auto-generation skipped: ${response.data.reason}`);
        }
      } catch (error) {
        console.error('[JobBrief] Auto-generation failed:', error);
        // Silently fail - don't disrupt user experience
      }
    };

    autoGenerate();
  }, [job.id]); // Only depend on job.id, not isEditing

  const handleEdit = () => {
    setEditedBrief(job.job_brief || "");
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSave = async () => {
    try {
      await base44.entities.Job.update(job.id, {
        job_brief: editedBrief,
        job_brief_source: 'manual',
        job_brief_locked: true
      });
      
      setIsEditing(false);
      onRefresh();
      toast.success('Job brief saved');
    } catch (error) {
      toast.error('Failed to save job brief');
    }
  };

  const handleCancel = () => {
    setEditedBrief(job.job_brief || "");
    setIsEditing(false);
  };

  const handleRegenerate = async () => {
    setShowRegenerateConfirm(false);
    setIsGenerating(true);
    
    try {
      const response = await base44.functions.invoke('generateJobBrief', {
        job_id: job.id,
        mode: 'force'
      });

      if (response.data.success) {
        onRefresh();
        toast.success('Job brief regenerated');
      } else {
        toast.error(response.data.message || 'Failed to regenerate');
      }
    } catch (error) {
      toast.error('Failed to regenerate job brief');
    } finally {
      setIsGenerating(false);
    }
  };

  const isManual = job.job_brief_source === 'manual';
  const hasContent = job.job_brief && job.job_brief.trim().length > 0;

  return (
    <>
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
              Job Brief
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={isManual ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                {isManual ? (
                  <>
                    <Edit className="w-3 h-3 mr-1" />
                    Manual
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI
                  </>
                )}
              </Badge>
              {!isEditing && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="h-8 text-xs"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRegenerateConfirm(true)}
                    disabled={isGenerating}
                    className="h-8 text-xs"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
          {!isManual && job.job_brief_last_generated_at && (
            <p className="text-[12px] text-[#6B7280] mt-1">
              Last generated {formatDistanceToNow(new Date(job.job_brief_last_generated_at), { addSuffix: true })}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                ref={textareaRef}
                value={editedBrief}
                onChange={(e) => setEditedBrief(e.target.value)}
                placeholder="Enter job brief for technician..."
                className="min-h-[200px] font-mono text-[13px]"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="h-9"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : hasContent ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-[14px] text-[#111827] leading-relaxed">
                {job.job_brief}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-[14px] text-[#9CA3AF]">
              No job brief yet. Click Regenerate to create one.
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              Regenerate Job Brief?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-slate-600 leading-[1.4]">
              This will replace your current job brief with a new AI-generated version. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] rounded-xl font-semibold"
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}