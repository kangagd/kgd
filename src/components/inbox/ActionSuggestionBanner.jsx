import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, X, FolderKanban, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ActionSuggestionBanner({ thread }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const dismissMutation = useMutation({
    mutationFn: () => base44.entities.EmailThread.update(thread.id, { action_dismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const project = await base44.entities.Project.create(data);
      await base44.entities.EmailThread.update(thread.id, {
        linked_project_id: project.id,
        linked_project_title: project.title,
        action_dismissed: true
      });
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      navigate(createPageUrl("Projects") + `?projectId=${project.id}`);
    }
  });

  const createJobMutation = useMutation({
    mutationFn: async (data) => {
      const job = await base44.entities.Job.create(data);
      await base44.entities.EmailThread.update(thread.id, {
        linked_job_id: job.id,
        linked_job_number: job.job_number,
        action_dismissed: true
      });
      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      navigate(createPageUrl("Jobs") + `?jobId=${job.id}`);
    }
  });

  if (thread.action_dismissed || thread.suggested_action === 'none') {
    return null;
  }

  const actionData = thread.suggested_action_data || {};
  const isProject = thread.suggested_action === 'create_project';

  const handleCreate = () => {
    if (isProject) {
      createProjectMutation.mutate({
        customer_name: actionData.customer_name || thread.from_address,
        customer_email: actionData.customer_email || thread.from_address,
        customer_phone: actionData.customer_phone || '',
        title: actionData.title || thread.subject,
        description: actionData.description || thread.last_message_snippet,
        project_type: actionData.project_type || 'Garage Door Install',
        address_full: actionData.address || '',
        status: 'Lead'
      });
    } else {
      createJobMutation.mutate({
        customer_name: actionData.customer_name || thread.from_address,
        customer_email: actionData.customer_email || thread.from_address,
        customer_phone: actionData.customer_phone || '',
        notes: actionData.notes || thread.last_message_snippet,
        product: actionData.product || 'Garage Door',
        address_full: actionData.address || '',
        status: 'Open',
        scheduled_date: new Date().toISOString().split('T')[0]
      });
    }
  };

  return (
    <Card className="border-l-4 border-l-[#FAE008] bg-[#FFFEF5] shadow-sm mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Lightbulb className="w-5 h-5 text-[#D97706]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                {isProject ? (
                  <FolderKanban className="w-4 h-4 text-[#D97706]" />
                ) : (
                  <Briefcase className="w-4 h-4 text-[#D97706]" />
                )}
                <h4 className="font-semibold text-[#92400E] text-sm">
                  {isProject ? 'Project Opportunity Detected' : 'Service Request Detected'}
                </h4>
              </div>
              <button
                onClick={() => dismissMutation.mutate()}
                className="text-[#92400E] hover:text-[#78350F] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-[#92400E] mb-3">
              AI detected this email may need a {isProject ? 'project' : 'job'}. Review and confirm to auto-create with pre-filled details.
            </p>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[#D97706] font-medium flex items-center gap-1 mb-3 hover:underline"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show Pre-filled Details
                </>
              )}
            </button>

            {expanded && (
              <div className="bg-white/60 rounded-lg p-3 mb-3 text-xs space-y-1">
                {actionData.customer_name && (
                  <div><span className="font-medium">Customer:</span> {actionData.customer_name}</div>
                )}
                {actionData.customer_phone && (
                  <div><span className="font-medium">Phone:</span> {actionData.customer_phone}</div>
                )}
                {actionData.address && (
                  <div><span className="font-medium">Address:</span> {actionData.address}</div>
                )}
                {isProject ? (
                  <>
                    {actionData.title && (
                      <div><span className="font-medium">Title:</span> {actionData.title}</div>
                    )}
                    {actionData.project_type && (
                      <div><span className="font-medium">Type:</span> {actionData.project_type}</div>
                    )}
                  </>
                ) : (
                  <>
                    {actionData.product && (
                      <div><span className="font-medium">Product:</span> {actionData.product}</div>
                    )}
                  </>
                )}
                {actionData.description && (
                  <div><span className="font-medium">Description:</span> {actionData.description}</div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={createProjectMutation.isPending || createJobMutation.isPending}
                className="bg-[#D97706] hover:bg-[#B45309] text-white font-semibold text-sm h-9"
              >
                {createProjectMutation.isPending || createJobMutation.isPending ? (
                  'Creating...'
                ) : (
                  `Create ${isProject ? 'Project' : 'Job'}`
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => dismissMutation.mutate()}
                className="text-sm h-9"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}