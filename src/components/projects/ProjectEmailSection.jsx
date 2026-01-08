import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Link as LinkIcon, Plus, RefreshCw, ExternalLink, Reply, Forward, FileEdit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import EmailMessageView from "../inbox/EmailMessageView";
import EmailComposer from "../inbox/EmailComposer";
import { Input } from "@/components/ui/input";
import LinkEmailThreadModal from "./LinkEmailThreadModal";

export default function ProjectEmailSection({ project, onThreadLinked }) {
  const queryClient = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [composerMode, setComposerMode] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch email threads linked to this project
  const { data: linkedThreads = [], isLoading: threadLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['projectEmailThreads', project.id],
    queryFn: async () => {
      const threads = await base44.entities.EmailThread.filter({ 
        project_id: project.id 
      }, '-last_message_date');
      return threads;
    },
    enabled: !!project.id,
    staleTime: 0, // Always refetch to ensure latest linked status
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Fetch messages for linked threads
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['projectEmailMessages', project.id, linkedThreads.map(t => t.id).join(',')],
    queryFn: async () => {
      if (linkedThreads.length === 0) return [];
      const allMessages = [];
      for (const thread of linkedThreads) {
        const threadMessages = await base44.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        }, '-sent_at');
        allMessages.push(...threadMessages);
      }
      return allMessages;
    },
    enabled: linkedThreads.length > 0
  });

  const emailThread = linkedThreads[0];

  // Fetch drafts related to this project's threads
  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ['projectEmailDrafts', project.id, linkedThreads.map(t => t.id).join(',')],
    queryFn: async () => {
      const user = await base44.auth.me();
      const allDrafts = await base44.entities.EmailDraft.filter({ created_by: user.email }, '-updated_date');
      const threadIds = linkedThreads.map(t => t.id);
      return allDrafts.filter(d => threadIds.includes(d.thread_id));
    },
    enabled: linkedThreads.length > 0
  });

  // Link thread mutation
  const linkThreadMutation = useMutation({
    mutationFn: async (threadId) => {
      const response = await base44.functions.invoke('linkEmailThreadToProject', {
        email_thread_id: threadId,
        project_id: project.id,
        set_as_primary: linkedThreads.length === 0
      });
      return response.data;
    },
    onSuccess: async () => {
      // CRITICAL: Invalidate all email queries to ensure inbox shows updated link status
      await queryClient.invalidateQueries({ queryKey: ['projectEmailThreads', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['myEmailThreads'] });
      await queryClient.refetchQueries({ queryKey: ['projectEmailThreads', project.id] });
      setShowLinkModal(false);
      toast.success('Email thread linked');
      if (onThreadLinked) onThreadLinked();
    },
    onError: (error) => {
      toast.error(`Failed to link: ${error.message}`);
    }
  });

  // Unlink thread mutation
  const unlinkThreadMutation = useMutation({
    mutationFn: async (threadId) => {
      await base44.entities.EmailThread.update(threadId, {
        project_id: null,
        project_number: null,
        project_title: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectEmailThreads', project.id] });
      toast.success('Email thread unlinked');
    }
  });

  const handleRefresh = async () => {
    await refetchThreads();
    await refetchMessages();
    toast.success('Emails refreshed');
  };

  const handleReply = (message, thread) => {
    setSelectedMessage(message);
    setComposerMode({ type: 'reply', thread: thread });
  };

  const handleForward = (message, thread) => {
    setSelectedMessage(message);
    setComposerMode({ type: 'forward', thread: thread });
  };

  const handleCompose = () => {
    setSelectedMessage(null);
    setComposerMode('compose');
  };

  const handleEmailSent = async (threadId) => {
    setComposerMode(null);
    setSelectedMessage(null);
    setEditingDraft(null);
    
    // Invalidate and refetch to show updated threads/messages
    await queryClient.invalidateQueries({ queryKey: ['projectEmailThreads', project.id] });
    await queryClient.invalidateQueries({ queryKey: ['myEmailThreads'] });
    await queryClient.refetchQueries({ queryKey: ['projectEmailThreads', project.id] });
    await refetchMessages();
    await refetchDrafts();
  };

  const handleDraftSaved = () => {
    refetchDrafts();
  };

  const handleOpenDraft = (draft) => {
    setEditingDraft(draft);
    setComposerMode(draft.mode || 'compose');
  };

  const handleDeleteDraft = async (e, draftId) => {
    e.stopPropagation();
    try {
      await base44.entities.EmailDraft.delete(draftId);
      refetchDrafts();
      toast.success('Draft deleted');
    } catch (error) {
      toast.error('Failed to delete draft');
    }
  };

  const isLoading = threadLoading || messagesLoading;

  // No linked threads - show option to link
  if (linkedThreads.length === 0) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardContent className="p-8 text-center">
          <Mail className="w-12 h-12 text-[#E5E7EB] mx-auto mb-4" />
          <h3 className="text-[16px] font-semibold text-[#111827] mb-2">No Emails</h3>
          <p className="text-[14px] text-[#6B7280] mb-6">
            Link an email thread to view project communications.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => setShowLinkModal(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Link Email Thread
            </Button>
            <Button
              variant="outline"
              onClick={handleCompose}
              className="border-[#E5E7EB]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Email
            </Button>
          </div>

          {/* Email Composer */}
          {composerMode && (
            <div className="mt-6 text-left">
              <EmailComposer
                mode={composerMode.type || composerMode}
                thread={composerMode.thread || null}
                message={selectedMessage}
                onClose={() => {
                  setComposerMode(null);
                  setSelectedMessage(null);
                }}
                onSent={handleEmailSent}
                onDraftSaved={handleDraftSaved}
                defaultTo={project.customer_email}
                projectId={project.id}
                existingDraft={editingDraft}
              />
            </div>
          )}

          {/* Link Thread Modal */}
          <LinkEmailThreadModal
            open={showLinkModal}
            onClose={() => setShowLinkModal(false)}
            projectId={project.id}
            onLink={(threadId) => linkThreadMutation.mutate(threadId)}
            isLinking={linkThreadMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drafts Banner */}
      {drafts.length > 0 && !composerMode && (
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileEdit className="w-4 h-4 text-amber-600" />
              <span className="text-[13px] font-medium text-amber-800">
                {drafts.length} Draft{drafts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {drafts.slice(0, 3).map(draft => (
                <div 
                  key={draft.id}
                  onClick={() => handleOpenDraft(draft)}
                  className="flex items-center justify-between p-2 bg-white rounded border border-amber-100 cursor-pointer hover:border-amber-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#111827] truncate">
                      {draft.subject || '(No subject)'}
                    </p>
                    <p className="text-[12px] text-[#6B7280] truncate">
                      To: {draft.to_addresses?.join(', ') || '(No recipient)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {draft.mode === 'reply' ? 'Reply' : draft.mode === 'forward' ? 'Forward' : 'Draft'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteDraft(e, draft.id)}
                      className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {drafts.length > 3 && (
                <p className="text-[12px] text-amber-600 text-center">
                  +{drafts.length - 3} more draft{drafts.length - 3 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-[#E5E7EB] rounded w-1/3 mb-3"></div>
                <div className="h-3 bg-[#E5E7EB] rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-[#E5E7EB] rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Show each thread */}
          {linkedThreads.map((thread) => {
            const threadMessages = messages
              .filter(m => m.thread_id === thread.id)
              .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

            return (
              <Card key={thread.id} className="border border-[#E5E7EB] shadow-sm rounded-lg">
                <CardHeader className="px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Mail className="w-5 h-5 text-[#FAE008]" />
                        <CardTitle className="text-[16px] font-semibold text-[#111827] truncate">
                          {thread.subject || 'Email Thread'}
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px]">
                          {threadMessages.length} msg
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-8"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(createPageUrl('Inbox') + `?threadId=${thread.id}`, '_blank')}
                        className="h-8"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unlinkThreadMutation.mutate(thread.id)}
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        disabled={unlinkThreadMutation.isPending}
                      >
                        Unlink
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                      onClick={handleCompose}
                      size="sm"
                      className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      New Email
                    </Button>
                    {threadMessages.length > 0 && (
                      <>
                        <Button
                          onClick={() => handleReply(threadMessages[threadMessages.length - 1], thread)}
                          variant="outline"
                          size="sm"
                          className="h-9"
                        >
                          <Reply className="w-4 h-4 mr-1" />
                          Reply
                        </Button>
                        <Button
                          onClick={() => handleForward(threadMessages[threadMessages.length - 1], thread)}
                          variant="outline"
                          size="sm"
                          className="h-9"
                        >
                          <Forward className="w-4 h-4 mr-1" />
                          Forward
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {threadMessages.map((message) => (
                      <EmailMessageView
                        key={message.id}
                        message={message}
                        isFirst={true}
                        linkedProjectId={project.id}
                        threadSubject={thread.subject}
                        gmailMessageId={message.gmail_message_id}
                        onReply={handleReply}
                        onForward={handleForward}
                        thread={thread}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Button to link more threads */}
          <Button
            variant="outline"
            onClick={() => setShowLinkModal(true)}
            className="w-full border-dashed border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Another Email Thread
          </Button>
        </>
      )}

      {/* Link Thread Modal */}
      <LinkEmailThreadModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        projectId={project.id}
        onLink={(threadId) => linkThreadMutation.mutate(threadId)}
        isLinking={linkThreadMutation.isPending}
      />
    </div>
  );
}
  const [searchTerm, setSearchTerm] = useState("");