import React, { useState } from "react";
import { Check, XCircle, ChevronDown, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const PROJECT_STAGES = [
  "Lead",
  "Initial Site Visit",
  "Create Quote",
  "Quote Sent",
  "Quote Approved",
  "Final Measure",
  "Parts Ordered",
  "Scheduled",
  "Completed",
  "Warranty"
];

export default function ProjectStageSelector({ projectId, currentStage, onStageChange, canEdit }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [targetStage, setTargetStage] = useState(null);
  const [stageNotes, setStageNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch automation rules to check for auto-create job
  const { data: automationRules = [] } = useQuery({
    queryKey: ['stageAutomationRules'],
    queryFn: () => base44.entities.StageAutomationRules.list(),
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  const changeStageMutation = useMutation({
    mutationFn: async ({ newStage, notes }) => {
      const response = await base44.functions.invoke('performProjectStageChange', {
        project_id: projectId,
        new_stage: newStage,
        notes: notes
      });
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Project stage updated to ${data.project.status}`);
      if (data.auto_created_jobs && data.auto_created_jobs.length > 0) {
        toast.success(`${data.auto_created_jobs.length} job(s) automatically created.`);
      }
      setIsConfirmOpen(false);
      setTargetStage(null);
      setStageNotes("");
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectStageHistory', projectId] });
      if (onStageChange) onStageChange(data.project.status);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsConfirmOpen(false);
    }
  });

  const handleStageSelect = (value) => {
    if (value === currentStage) return;
    setTargetStage(value);
    setStageNotes("");
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!targetStage) return;
    changeStageMutation.mutate({ newStage: targetStage, notes: stageNotes });
  };

  const targetRule = automationRules.find(r => r.stage_name === targetStage);
  const willAutoCreateJob = targetRule?.auto_create_job;

  // Determine if movement is backward
  // We use the full list including "Lost" to match backend logic
  const FULL_STAGE_ORDER = [...PROJECT_STAGES, "Lost"];
  const currentIndex = FULL_STAGE_ORDER.indexOf(currentStage);
  const targetIndex = FULL_STAGE_ORDER.indexOf(targetStage);
  const isBackward = currentIndex !== -1 && targetIndex !== -1 && targetIndex < currentIndex;

  // Get styling for current stage
  const isLost = currentStage === "Lost";
  
  const getStageColor = (stage) => {
    if (stage === "Lost") return "bg-red-100 text-red-700 border-red-200";
    if (stage === "Warranty") return "bg-amber-100 text-amber-700 border-amber-200";
    if (stage === "Completed") return "bg-green-100 text-green-700 border-green-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <label className="text-xs font-medium text-slate-500 mb-1">Current Stage</label>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Select 
              value={currentStage} 
              onValueChange={handleStageSelect}
              disabled={changeStageMutation.isPending}
            >
              <SelectTrigger className={`w-[200px] h-9 font-medium ${getStageColor(currentStage)} border-transparent focus:ring-0`}>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage} className="font-medium">
                    {stage}
                  </SelectItem>
                ))}
                <SelectItem value="Lost" className="text-red-600 font-medium">
                  Lost
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge className={`text-sm px-3 py-1 ${getStageColor(currentStage)} hover:${getStageColor(currentStage)}`}>
              {currentStage}
            </Badge>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Project Stage</DialogTitle>
            <DialogDescription>
              Are you sure you want to move this project from <span className="font-bold text-slate-900">{currentStage}</span> to <span className="font-bold text-slate-900">{targetStage}</span>?
            </DialogDescription>
          </DialogHeader>

          {/* Backward Movement Warning */}
          {isBackward && (
            <div className="bg-amber-50 border border-amber-100 rounded-md p-3 flex gap-3 my-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Moving Backward</p>
                This project is moving backward. Some automation actions may pause but will not be deleted.
              </div>
            </div>
          )}

          {willAutoCreateJob && !isBackward && (
            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex gap-3 my-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Automation Alert</p>
                Moving to this stage will automatically create a new Job.
                {targetRule.job_type_id && " (Job Type defined in rules)"}
              </div>
            </div>
          )}

          {targetStage === "Lost" && (
            <div className="bg-red-50 border border-red-100 rounded-md p-3 flex gap-3 my-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-semibold mb-1">Warning</p>
                Marking as Lost will cancel open jobs and decline any pending quotes.
              </div>
            </div>
          )}

          <div className="space-y-2 mt-2">
            <label className="text-sm font-medium text-slate-700">Stage Change Notes (Optional)</label>
            <Textarea 
              placeholder="Why is the stage changing?" 
              value={stageNotes}
              onChange={(e) => setStageNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={changeStageMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {changeStageMutation.isPending ? "Updating..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}