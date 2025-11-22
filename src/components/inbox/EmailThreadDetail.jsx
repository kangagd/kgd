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
import { X, Link as LinkIcon, Plus, ExternalLink, Reply, Forward, Mail, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import EmailMessageView from "./EmailMessageView";
import EmailComposer from "./EmailComposer";
import EmailThreadSummary from "./EmailThreadSummary";
import ResponseSuggestions from "./ResponseSuggestions";
import AttachmentCard from "./AttachmentCard";
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
  const [composerMode, setComposerMode] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [prefilledBody, setPrefilledBody] = useState("");

  const { data: messages = [], refetch } = useQuery({
    queryKey: ['emailMessages', thread.id],
    queryFn: () => base44.entities.EmailMessage.filter({ thread_id: thread.id }, 'sent_at'),
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  const handleReply = (message) => {
    setSelectedMessage(message);
    setComposerMode("reply");
  };

  const handleForward = (message) => {
    setSelectedMessage(message);
    setComposerMode("forward");
  };

  const handleCompose = () => {
    setSelectedMessage(null);
    setComposerMode("compose");
  };

  const handleUseTemplate = (template) => {
    setPrefilledBody(template);
    handleReply(messages[messages.length - 1]);
  };

  const handleCloseComposer = () => {
    setComposerMode(null);
    setSelectedMessage(null);
    setPrefilledBody("");
  };

  const handleEmailSent = () => {
    refetch();
  };



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

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
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

          {userPermissions?.can_reply && (
            <>
              <Button variant="outline" size="sm" onClick={handleCompose}>
                <Mail className="w-4 h-4 mr-2" />
                New Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleReply(messages[messages.length - 1])}>
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
            </>
          )}
          </div>

        {/* Linked Items */}
        {(thread.linked_project_id || thread.linked_job_id) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
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
        {/* AI Summary - Always First */}
        <EmailThreadSummary thread={thread} messages={messages} />

        {/* Quick Actions Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Attachments Preview */}
          {messages.some(m => m.attachments?.length > 0) && (
            <div className="group bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200/50 p-3 hover:shadow-md transition-all relative">
              <div className="text-[12px] text-[#6B7280] font-semibold mb-2 flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5" />
                Attachments ({messages.reduce((acc, m) => acc + (m.attachments?.length || 0), 0)})
              </div>
              <div className="space-y-2 max-h-20 overflow-hidden group-hover:max-h-[500px] transition-all duration-300">
                {messages.flatMap(message => 
                  (message.attachments || []).map((attachment, idx) => (
                    <AttachmentCard
                      key={`${message.id}-${idx}`}
                      attachment={attachment}
                      linkedJobId={thread.linked_job_id}
                      linkedProjectId={thread.linked_project_id}
                      threadSubject={thread.subject}
                      threadCategory={thread.category}
                    />
                  ))
                )}
              </div>
              {messages.reduce((acc, m) => acc + (m.attachments?.length || 0), 0) > 1 && (
                <div className="text-[11px] text-[#6B7280] mt-2 group-hover:hidden">
                  Hover to see all
                </div>
              )}
            </div>
          )}

          {/* AI Response Suggestions */}
          {!composerMode && messages.length > 0 && userPermissions?.can_reply && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200/50 p-3 hover:shadow-md transition-all">
              <ResponseSuggestions 
                thread={thread} 
                messages={messages}
                onUseTemplate={handleUseTemplate}
              />
            </div>
          )}
          </div>

          {composerMode && (
          <EmailComposer
            mode={composerMode}
            thread={thread}
            message={selectedMessage}
            onClose={handleCloseComposer}
            onSent={handleEmailSent}
            prefilledBody={prefilledBody}
          />
        )}

        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-[#4B5563]">No messages in this thread</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id}>
              <EmailMessageView 
                message={message} 
                isFirst={index === 0}
                linkedJobId={thread.linked_job_id}
                linkedProjectId={thread.linked_project_id}
                threadSubject={thread.subject}
                threadCategory={thread.category}
              />
              {userPermissions?.can_reply && (
                <div className="flex gap-2 mt-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReply(message)}
                    className="text-[13px] h-8"
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    Reply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleForward(message)}
                    className="text-[13px] h-8"
                  >
                    <Forward className="w-3 h-3 mr-1" />
                    Forward
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}