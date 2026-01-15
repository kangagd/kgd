import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Mail, Trash2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { inboxKeys } from "@/components/api/queryKeys";

export default function DraftsList({ onOpenDraft }) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);

  const { data: drafts = [], isLoading, refetch } = useQuery({
    queryKey: inboxKeys.drafts(),
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user) return [];
      const allDrafts = await base44.entities.EmailDraft.filter(
        { status: 'draft', created_by: user.email },
        "-updated_date"
      );
      return allDrafts;
    },
    refetchInterval: 30000, // Refetch every 30s
  });

  // Trigger refetch when invalidated
  useEffect(() => {
    refetch();
  }, []);

  // Fetch linked entities for display
  const { data: linkedProjects = [] } = useQuery({
    queryKey: ["draftLinkedProjects", drafts.map(d => d.linkedEntityId).filter(Boolean)],
    queryFn: async () => {
      const projectIds = drafts
        .filter(d => d.linkedEntityType === "project" && d.linkedEntityId)
        .map(d => d.linkedEntityId);
      if (projectIds.length === 0) return [];
      
      const projects = await Promise.all(
        projectIds.map(id => base44.entities.Project.get(id).catch(() => null))
      );
      return projects.filter(Boolean);
    },
    enabled: drafts.length > 0,
  });

  const { data: linkedJobs = [] } = useQuery({
    queryKey: ["draftLinkedJobs", drafts.map(d => d.linkedEntityId).filter(Boolean)],
    queryFn: async () => {
      const jobIds = drafts
        .filter(d => d.linkedEntityType === "job" && d.linkedEntityId)
        .map(d => d.linkedEntityId);
      if (jobIds.length === 0) return [];
      
      const jobs = await Promise.all(
        jobIds.map(id => base44.entities.Job.get(id).catch(() => null))
      );
      return jobs.filter(Boolean);
    },
    enabled: drafts.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (draftId) => base44.entities.EmailDraft.delete(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast.success("Draft deleted");
      setDeleteDialogOpen(false);
      setSelectedDraft(null);
    },
    onError: (error) => {
      toast.error("Failed to delete draft");
      console.error(error);
    },
  });

  const handleDelete = (draft) => {
    setSelectedDraft(draft);
    setDeleteDialogOpen(true);
  };

  const getLinkedEntity = (draft) => {
    if (draft.linkedEntityType === "project" && draft.linkedEntityId) {
      const project = linkedProjects.find(p => p.id === draft.linkedEntityId);
      return project ? { type: "Project", label: `#${project.project_number} ${project.title}` } : null;
    } else if (draft.linkedEntityType === "job" && draft.linkedEntityId) {
      const job = linkedJobs.find(j => j.id === draft.linkedEntityId);
      return job ? { type: "Job", label: `#${job.job_number}` } : null;
    }
    return null;
  };

  const getStatusBadge = (status) => {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        Draft
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Mail className="w-12 h-12 text-[#9CA3AF] mb-3" />
        <p className="text-[#6B7280] text-sm">No drafts</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {drafts.map((draft) => {
          const linkedEntity = getLinkedEntity(draft);
          const firstRecipient = draft.to_addresses?.[0] || "No recipient";
          const recipientCount = draft.to_addresses?.length || 0;

          return (
            <Card
              key={draft.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onOpenDraft(draft)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#111827] truncate">
                      To: {firstRecipient}
                      {recipientCount > 1 && (
                        <span className="text-[#6B7280] ml-1">+{recipientCount - 1} more</span>
                      )}
                    </span>
                  </div>
                  
                  <p className="text-sm text-[#111827] font-medium mb-1 truncate">
                    {draft.subject || "(No subject)"}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                   <span className="flex items-center gap-1">
                     <Clock className="w-3 h-3" />
                     {draft.updated_date 
                       ? formatDistanceToNow(new Date(draft.updated_date), { addSuffix: true })
                       : "Not saved"}
                   </span>
                    
                    {linkedEntity && (
                      <Badge variant="outline" className="text-xs">
                        {linkedEntity.type}: {linkedEntity.label}
                      </Badge>
                    )}
                  </div>


                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(draft.status)}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(draft);
                    }}

                  >
                    <Trash2 className="w-4 h-4 text-[#6B7280] hover:text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The draft will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDraft && deleteMutation.mutate(selectedDraft.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}