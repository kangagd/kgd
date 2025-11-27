import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Link as LinkIcon, Plus, Send, RefreshCw, ExternalLink, Reply, Forward } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import EmailMessageView from "../inbox/EmailMessageView";
import EmailComposer from "../inbox/EmailComposer";
import LinkThreadModal from "../inbox/LinkThreadModal";

export default function ProjectEmailSection({ project, onThreadLinked }) {
  const queryClient = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [composerMode, setComposerMode] = useState(null); // null | 'compose' | 'reply' | 'forward'
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Fetch ALL email threads linked to this project
  const { data: linkedThreads = [], isLoading: threadLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['projectEmailThreads', project.id],
    queryFn: async () => {
      const allThreads = await base44.entities.EmailThread.list('-last_message_date');
      return allThreads.filter(t => 
        t.linked_project_id === project.id || 
        t.id === project.source_email_thread_id
      );
    },
    enabled: !!project.id
  });

  // Fetch messages for all linked threads
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['projectEmailMessages', project.id, linkedThreads.map(t => t.id)],
    queryFn: async () => {
      if (linkedThreads.length === 0) return [];
      const threadIds = linkedThreads.map(t => t.id);
      const allMessages = await base44.entities.EmailMessage.list();
      return allMessages.filter(m => threadIds.includes(m.thread_id));
    },
    enabled: linkedThreads.length > 0
  });

  // For backward compatibility - use first thread as "emailThread"
  const emailThread = linkedThreads[0];

  // Fetch unlinked email threads for linking
  const { data: availableThreads = [] } = useQuery({
    queryKey: ['unlinkedEmailThreads'],
    queryFn: async () => {
      const threads = await base44.entities.EmailThread.filter({ 
        linked_project_id: { $exists: false }
      });
      return threads.filter(t => !t.linked_project_id);
    },
    enabled: showLinkModal
  });

  // Link thread mutation
  const linkThreadMutation = useMutation({
    mutationFn: async (threadId) => {
      const thread = await base44.entities.EmailThread.get(threadId);
      
      // Update thread with project link
      await base44.entities.EmailThread.update(threadId, {
        linked_project_id: project.id,
        linked_project_title: project.title
      });
      
      // Update project with thread link
      await base44.entities.Project.update(project.id, {
        source_email_thread_id: threadId
      });
      
      return thread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailThread'] });
      queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      setShowLinkModal(false);
      toast.success('Email thread linked to project');
      if (onThreadLinked) onThreadLinked();
    },
    onError: (error) => {
      toast.error(`Failed to link thread: ${error.message}`);
    }
  });

  // Unlink thread mutation
  const unlinkThreadMutation = useMutation({
    mutationFn: async () => {
      if (project.source_email_thread_id) {
        await base44.entities.EmailThread.update(project.source_email_thread_id, {
          linked_project_id: null,
          linked_project_title: null
        });
      }
      
      await base44.entities.Project.update(project.id, {
        source_email_thread_id: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailThread'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success('Email thread unlinked');
    }
  });

  const handleRefresh = async () => {
    await refetchThreads();
    await refetchMessages();
    toast.success('Emails refreshed');
  };

  const handleReply = (message) => {
    setSelectedMessage(message);
    setComposerMode('reply');
  };

  const handleForward = (message) => {
    setSelectedMessage(message);
    setComposerMode('forward');
  };

  const handleCompose = () => {
    setSelectedMessage(null);
    setComposerMode('compose');
  };

  const handleEmailSent = () => {
    setComposerMode(null);
    setSelectedMessage(null);
    refetchMessages();
  };

  const isLoading = threadLoading || messagesLoading;

  // No linked threads - show option to link
  if (linkedThreads.length === 0 && !project.source_email_thread_id) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardContent className="p-8 text-center">
          <Mail className="w-12 h-12 text-[#E5E7EB] mx-auto mb-4" />
          <h3 className="text-[16px] font-semibold text-[#111827] mb-2">No Linked Email Thread</h3>
          <p className="text-[14px] text-[#6B7280] mb-6">
            Link an email thread to view and manage customer communications for this project.
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
                mode={composerMode}
                thread={null}
                message={null}
                onClose={() => setComposerMode(null)}
                onSent={handleEmailSent}
                defaultTo={project.customer_email}
                projectId={project.id}
              />
            </div>
          )}

          {/* Link Thread Modal */}
          <LinkEmailThreadModal
            open={showLinkModal}
            onClose={() => setShowLinkModal(false)}
            threads={availableThreads}
            onSelect={(threadId) => linkThreadMutation.mutate(threadId)}
            isLinking={linkThreadMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Email Composer */}
      {composerMode && (
        <EmailComposer
          mode={composerMode}
          thread={emailThread}
          message={selectedMessage}
          onClose={() => {
            setComposerMode(null);
            setSelectedMessage(null);
          }}
          onSent={handleEmailSent}
          defaultTo={composerMode === 'compose' ? project.customer_email : undefined}
          projectId={project.id}
        />
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
          {/* Show each linked thread */}
          {linkedThreads.map((thread) => {
            const threadMessages = messages
              .filter(m => m.thread_id === thread.id)
              .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
            
            return (
              <Card key={thread.id} className="border border-[#E5E7EB] shadow-sm rounded-lg">
                <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Mail className="w-5 h-5 text-[#FAE008]" />
                        <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2] truncate">
                          {thread.subject || 'Email Thread'}
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px]">
                          {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {thread.from_address && (
                        <p className="text-[13px] text-[#6B7280] mt-1">
                          From: {thread.from_address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-8 text-[#6B7280] hover:text-[#111827]"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(createPageUrl('Inbox') + `?threadId=${thread.id}`, '_blank')}
                        className="h-8 text-[#6B7280] hover:text-[#111827]"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unlinkThreadMutation.mutate()}
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
                          onClick={() => handleReply(threadMessages[threadMessages.length - 1])}
                          variant="outline"
                          size="sm"
                          className="h-9"
                        >
                          <Reply className="w-4 h-4 mr-1" />
                          Reply
                        </Button>
                        <Button
                          onClick={() => handleForward(threadMessages[threadMessages.length - 1])}
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

                  {/* Messages for this thread */}
                  {threadMessages.length === 0 ? (
                    <p className="text-[14px] text-[#6B7280] text-center py-4">No messages in this thread yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {threadMessages.map((message, index) => (
                        <div key={message.id} className="relative">
                          <EmailMessageView
                            message={message}
                            isFirst={true}
                            linkedProjectId={project.id}
                            threadSubject={thread.subject}
                            gmailMessageId={message.gmail_message_id || message.attachments?.[0]?.gmail_message_id}
                          />
                          {/* Quick actions */}
                          <div className="absolute top-3 right-12 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReply(message)}
                              className="h-7 w-7 hover:bg-[#F3F4F6]"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleForward(message)}
                              className="h-7 w-7 hover:bg-[#F3F4F6]"
                              title="Forward"
                            >
                              <Forward className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
        threads={availableThreads}
        onSelect={(threadId) => linkThreadMutation.mutate(threadId)}
        isLinking={linkThreadMutation.isPending}
      />
    </div>
  );
}

// Sub-component for linking email threads
function LinkEmailThreadModal({ open, onClose, threads, onSelect, isLinking }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredThreads = threads.filter(thread => 
    thread.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.from_address?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 30);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="text-[18px] font-semibold text-[#111827] mb-3">Link Email Thread</h3>
          <input
            type="text"
            placeholder="Search by subject or sender..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#FAE008] text-[14px]"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredThreads.length === 0 ? (
            <p className="text-center text-[#6B7280] py-8">No unlinked email threads found</p>
          ) : (
            filteredThreads.map(thread => (
              <div
                key={thread.id}
                onClick={() => !isLinking && onSelect(thread.id)}
                className={`p-3 border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:bg-[#FFFEF5] cursor-pointer transition-all ${isLinking ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <h4 className="text-[14px] font-semibold text-[#111827] truncate mb-1">
                  {thread.subject || '(No subject)'}
                </h4>
                <p className="text-[13px] text-[#6B7280]">
                  From: {thread.from_address}
                </p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">
                  {thread.message_count || 0} message{(thread.message_count || 0) !== 1 ? 's' : ''} • {thread.last_message_date ? new Date(thread.last_message_date).toLocaleDateString() : ''}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[#E5E7EB] flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLinking}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}