import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Link as LinkIcon, Plus, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import EmailMessageView from "./EmailMessageView";
import { createPageUrl } from "@/utils";

const statusColors = {
  "Open": "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-amber-100 text-amber-800 border-amber-200",
  "Closed": "bg-gray-100 text-gray-800 border-gray-200",
  "Archived": "bg-slate-100 text-slate-600 border-slate-200"
};

export default function EmailThreadDetail({
  thread,
  onClose,
  onStatusChange,
  onLinkProject,
  onLinkJob,
  onUnlinkProject,
  onUnlinkJob,
  onCreateProject,
  onCreateJob,
  userPermissions
}) {
  const { data: messages = [] } = useQuery({
    queryKey: ['emailMessages', thread.id],
    queryFn: () => base44.entities.EmailMessage.filter({ thread_id: thread.id }, 'sent_at')
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-[18px] font-semibold text-[#111827] mb-2">{thread.subject}</h2>
            <div className="flex items-center gap-2 text-[13px] text-[#4B5563]">
              <span className="font-medium">From:</span>
              <span>{thread.from_address}</span>
            </div>
            {thread.to_addresses?.length > 0 && (
              <div className="flex items-center gap-2 text-[13px] text-[#4B5563] mt-1">
                <span className="font-medium">To:</span>
                <span>{thread.to_addresses.join(', ')}</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Status and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {userPermissions?.can_change_status && (
            <Select value={thread.status} onValueChange={(value) => onStatusChange(thread.id, value)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          )}

          {!userPermissions?.can_change_status && (
            <Badge className={`${statusColors[thread.status]} px-3 py-1`}>
              {thread.status}
            </Badge>
          )}

          {userPermissions?.can_link_to_project && (
            <Button variant="outline" size="sm" onClick={onLinkProject}>
              <LinkIcon className="w-4 h-4 mr-2" />
              Link Project
            </Button>
          )}

          {userPermissions?.can_link_to_job && (
            <Button variant="outline" size="sm" onClick={onLinkJob}>
              <LinkIcon className="w-4 h-4 mr-2" />
              Link Job
            </Button>
          )}

          {userPermissions?.can_create_project_from_email && (
            <Button variant="outline" size="sm" onClick={onCreateProject}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          )}

          {userPermissions?.can_create_job_from_email && (
            <Button variant="outline" size="sm" onClick={onCreateJob}>
              <Plus className="w-4 h-4 mr-2" />
              Create Job
            </Button>
          )}
        </div>

        {/* Linked Items */}
        {(thread.linked_project_id || thread.linked_job_id) && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {thread.linked_project_id && (
              <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-lg px-3 py-2">
                <span className="text-[13px] text-[#4B5563] font-medium">Project:</span>
                <a
                  href={createPageUrl("Projects") + `?projectId=${thread.linked_project_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#111827] hover:underline flex items-center gap-1"
                >
                  {thread.linked_project_title}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {userPermissions?.can_link_to_project && (
                  <button onClick={onUnlinkProject} className="ml-2 text-[#6B7280] hover:text-[#DC2626]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {thread.linked_job_id && (
              <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-lg px-3 py-2">
                <span className="text-[13px] text-[#4B5563] font-medium">Job:</span>
                <a
                  href={createPageUrl("Jobs") + `?jobId=${thread.linked_job_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#111827] hover:underline flex items-center gap-1"
                >
                  #{thread.linked_job_number}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {userPermissions?.can_link_to_job && (
                  <button onClick={onUnlinkJob} className="ml-2 text-[#6B7280] hover:text-[#DC2626]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-[#4B5563]">No messages in this thread</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <EmailMessageView key={message.id} message={message} isFirst={index === 0} />
          ))
        )}
      </div>
    </div>
  );
}