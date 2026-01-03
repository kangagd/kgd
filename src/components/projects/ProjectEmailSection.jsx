import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Link as LinkIcon, Plus, Send, RefreshCw, ExternalLink, Reply, Forward, FileEdit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import EmailMessageView from "../inbox/EmailMessageView";
import EmailComposer from "../inbox/EmailComposer";
import LinkThreadModal from "../inbox/LinkThreadModal";
import GmailHistorySearch from "../inbox/GmailHistorySearch";

export default function ProjectEmailSection({ project, onThreadLinked }) {
  const queryClient = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [composerMode, setComposerMode] = useState(null); // null | 'compose' | { type: 'reply', thread: any } | { type: 'forward', thread: any }
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingDraft, setEditingDraft] = useState(null);
  
  // Historical Search State
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [showGmailHistoryModal, setShowGmailHistoryModal] = useState(false);
  const [historySearchInput, setHistorySearchInput] = useState("");
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);

  // Fetch ALL email threads linked to this project
  const { data: linkedThreads = [], isLoading: threadLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['projectEmailThreads', project.id, refreshKey],
    queryFn: async () => {
      // Fetch threads linked via linked_project_id
      const linkedByProject = await base44.entities.EmailThread.filter({ 
        linked_project_id: project.id 
      });
      
      // Also fetch by source_email_thread_id if set
      let sourceThread = null;
      if (project.source_email_thread_id) {
        try {
          sourceThread = await base44.entities.EmailThread.get(project.source_email_thread_id);
        } catch (e) {
          console.warn('Source thread not found:', project.source_email_thread_id);
        }
      }
      
      // Combine and dedupe
      const allThreads = [...linkedByProject];
      if (sourceThread && !allThreads.find(t => t.id === sourceThread.id)) {
        allThreads.push(sourceThread);
      }
      
      return allThreads.sort((a, b) => 
        new Date(b.last_message_date) - new Date(a.last_message_date)
      );
    },
    enabled: !!project.id,
    staleTime: 0
  });

  // Fetch messages for all linked threads - direct fetch, no caching issues
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['projectEmailMessages', project.id, linkedThreads.map(t => t.id).join(','), refreshKey],
    queryFn: async () => {
      if (linkedThreads.length === 0) return [];
      
      // Fetch messages for each thread directly
      const allMessages = [];
      for (const thread of linkedThreads) {
        const threadMessages = await base44.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        });
        allMessages.push(...threadMessages);
      }
      
      return allMessages;
    },
    enabled: linkedThreads.length > 0,
    staleTime: 0,
    cacheTime: 0
  });

  // Fetch Saved Historical Emails
  const { data: savedEmails = [], isLoading: savedEmailsLoading, refetch: refetchSavedEmails } = useQuery({
    queryKey: ["project-emails", project.id, refreshKey],
    queryFn: () => base44.entities.ProjectEmail.filter({ project_id: project.id }),
    enabled: !!project?.id,
  });

  // For backward compatibility - use first thread as "emailThread"
  const emailThread = linkedThreads[0];

  // Fetch all email threads for linking (not just unlinked)
  const { data: availableThreads = [] } = useQuery({
    queryKey: ['allEmailThreads'],
    queryFn: async () => {
      // Fetch all threads (up to 500 most recent) to allow searching
      const threads = await base44.entities.EmailThread.list('-last_message_date', 500);
      return threads;
    },
    enabled: showLinkModal
  });

  // Fetch drafts related to this project's threads
  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ['projectEmailDrafts', project.id, linkedThreads.map(t => t.id).join(',')],
    queryFn: async () => {
      const user = await base44.auth.me();
      const allDrafts = await base44.entities.EmailDraft.filter({ created_by: user.email }, '-updated_date');
      // Filter to only drafts that are replies to this project's threads
      const threadIds = linkedThreads.map(t => t.id);
      return allDrafts.filter(d => threadIds.includes(d.thread_id));
    },
    enabled: linkedThreads.length > 0
  });

  const handleSearchHistory = async () => {
    if (!historySearchInput.trim()) return;
    
    const emails = historySearchInput.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return;

    setIsSearchingHistory(true);
    try {
      const res = await base44.functions.invoke('fetchGmailHistory', { 
        emails, 
        projectId: project.id 
      });
      
      // Auto-link any found threads that match
      if (res.data?.threadIds?.length > 0) {
        const threadIds = res.data.threadIds;
        
        // Link each thread to this project
        for (const threadId of threadIds) {
          try {
            const thread = await base44.entities.EmailThread.get(threadId);
            
            // Only link if not already linked to another project
            if (!thread.linked_project_id) {
              await base44.entities.EmailThread.update(threadId, {
                linked_project_id: project.id,
                linked_project_title: project.title
              });
            }
          } catch (e) {
            console.warn(`Failed to link thread ${threadId}:`, e);
          }
        }
      }
      
      // Refresh saved emails and threads - force complete re-fetch
      setRefreshKey(k => k + 1); // Force re-fetch with new key
      
      // Wait a moment for backend to finish, then refetch everything
      await new Promise(resolve => setTimeout(resolve, 500));
      await refetchSavedEmails();
      await refetchThreads();
      await refetchMessages();
      
      if (res.data?.messages?.length > 0) {
        toast.success(`Found ${res.data.messages.length} historical emails and linked them`);
      } else {
        toast.info('No new historical emails found');
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Failed to search Gmail history');
    } finally {
      setIsSearchingHistory(false);
    }
  };

  // Combine Threads & Messages
  const { displayThreads, displayMessages } = React.useMemo(() => {
    // Normalize saved emails to message shape
    const normalisedSavedEmails = savedEmails.map((e) => ({
      id: e.id,
      gmail_message_id: e.gmail_message_id,
      thread_id: e.thread_id, // Gmail thread ID
      subject: e.subject,
      body_text: e.snippet, // Minimal content
      from_address: e.from_email,
      from_name: e.from_email?.split('<')[0]?.trim() || e.from_email,
      to_addresses: e.to_email ? e.to_email.split(',').map(s => s.trim()) : [],
      sent_at: e.sent_at,
      is_outbound: e.direction === 'outgoing',
      isHistorical: e.is_historical,
      source: e.source || "gmail",
      attachments: []
    }));

    // 1. Map historical messages to existing threads if possible
    const mappedHistorical = normalisedSavedEmails.map(msg => {
      const existingThread = linkedThreads.find(t => t.gmail_thread_id === msg.thread_id);
      return existingThread 
        ? { ...msg, thread_id: existingThread.id } // Map to UUID
        : msg; // Keep Gmail Thread ID
    });

    // 2. Identify virtual threads (historical threads not in linkedThreads)
    const virtualThreadIds = new Set();
    mappedHistorical.forEach(msg => {
      // If thread_id matches an existing UUID, it's already handled
      // If it's still a Gmail ID (long string usually), check if we have a thread for it
      const isLinked = linkedThreads.some(t => t.id === msg.thread_id);
      if (!isLinked) {
        virtualThreadIds.add(msg.thread_id);
      }
    });

    const virtualThreads = Array.from(virtualThreadIds).map(vThreadId => {
      const msgs = mappedHistorical.filter(m => m.thread_id === vThreadId);
      const first = msgs[0] || {};
      return {
        id: vThreadId,
        subject: first.subject || '(Historical Conversation)',
        from_address: first.from_address,
        last_message_date: msgs.reduce((latest, m) => new Date(m.sent_at) > new Date(latest) ? m.sent_at : latest, msgs[0]?.sent_at),
        message_count: msgs.length,
        isVirtual: true
      };
    });

    // 3. Combine threads (sort by date)
    const allThreads = [...linkedThreads, ...virtualThreads].sort((a, b) => 
      new Date(b.last_message_date) - new Date(a.last_message_date)
    );

    // 4. Combine messages (deduplicate by gmail_message_id just in case)
    const combinedMessages = [...messages];
    const existingMessageIds = new Set(messages.map(m => m.gmail_message_id));
    
    mappedHistorical.forEach(hm => {
      if (!existingMessageIds.has(hm.gmail_message_id)) {
        combinedMessages.push(hm);
      }
    });

    return { displayThreads: allThreads, displayMessages: combinedMessages };
  }, [linkedThreads, messages, savedEmails]);

  // Link thread mutation
  const linkThreadMutation = useMutation({
    mutationFn: async (threadId) => {
      // Use centralized linking function
      await base44.functions.invoke('linkEmailThreadToProject', {
        email_thread_id: threadId,
        project_id: project.id,
        set_as_primary: !project.primary_email_thread_id && !project.source_email_thread_id
      });
      
      // Maintain backward compatibility with source_email_thread_id
      if (!project.source_email_thread_id) {
        await base44.entities.Project.update(project.id, {
          source_email_thread_id: threadId
        });
      }
      
      return await base44.entities.EmailThread.get(threadId);
    },
    onSuccess: async (data, variables) => {
      // Run resync to ensure all attachments have IDs before rendering
      try {
        await base44.functions.invoke('resyncAttachments');
      } catch (e) {
        console.warn('Resync failed, continuing anyway', e);
      }

      // Auto-save attachments to project
      try {
        toast.info('Processing attachments...');
        const threadId = variables; // mutationFn takes threadId as argument
        const res = await base44.functions.invoke('saveThreadAttachments', {
          thread_id: threadId,
          target_type: 'project',
          target_id: project.id
        });
        if (res.data?.saved_count > 0) {
          toast.success(`Saved ${res.data.saved_count} attachments to project`);
        }
      } catch (e) {
        console.error('Auto-save attachments failed', e);
      }
      
      queryClient.invalidateQueries({ queryKey: ['emailThread'] });
      queryClient.invalidateQueries({ queryKey: ['emailThread', variables] });
      queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
      queryClient.invalidateQueries({ queryKey: ['projectEmailThreads'] });
      queryClient.invalidateQueries({ queryKey: ['projectEmailMessages'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
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
    // Force complete refresh by incrementing key
    setRefreshKey(k => k + 1);
    // Also refresh historical
    queryClient.invalidateQueries(["project-emails", project.id]);
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

  const handleEmailSent = () => {
    setComposerMode(null);
    setSelectedMessage(null);
    setEditingDraft(null);
    refetchMessages();
    refetchDrafts();
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

  const isLoading = threadLoading || messagesLoading || savedEmailsLoading;

  // No linked threads - show option to link
  if (linkedThreads.length === 0 && !project.source_email_thread_id && savedEmails.length === 0) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardContent className="p-8 text-center">
          <Mail className="w-12 h-12 text-[#E5E7EB] mx-auto mb-4" />
          <h3 className="text-[16px] font-semibold text-[#111827] mb-2">No Emails</h3>
          <p className="text-[14px] text-[#6B7280] mb-6">
            Link an email thread or search for historical emails to view communications for this project.
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

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] max-w-md mx-auto">
            <h4 className="text-sm font-medium text-[#111827] mb-3">Or load older emails from Gmail</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={historySearchInput}
                onChange={(e) => setHistorySearchInput(e.target.value)}
                placeholder="e.g. client@example.com"
                className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#FAE008]"
                onKeyDown={(e) => e.key === 'Enter' && handleSearchHistory()}
              />
              <Button 
                onClick={handleSearchHistory} 
                disabled={isSearchingHistory || !historySearchInput.trim()}
                size="sm"
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                {isSearchingHistory ? 'Searching...' : 'Search'}
              </Button>
            </div>
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
                onDraftSaved={handleDraftSaved}
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

      {/* Historical Search Panel */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setShowHistorySearch(!showHistorySearch)}
        >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <div className="bg-slate-100 p-1.5 rounded-md">
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isSearchingHistory ? 'animate-spin' : ''}`} />
          </div>
          Load older emails
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">
            {savedEmails.length > 0 ? `${savedEmails.length} loaded` : 'Search Gmail'}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setShowGmailHistoryModal(true);
            }}
            className="h-7 text-xs"
          >
            Advanced Search
          </Button>
        </div>
        </div>
        
        {showHistorySearch && (
          <CardContent className="p-3 pt-0 border-t border-slate-100 bg-slate-50/50">
            <div className="space-y-3 mt-3">
              <p className="text-xs text-slate-600">
                Fetch emails from Gmail history that aren't synced. Enter email addresses to search for.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={historySearchInput}
                  onChange={(e) => setHistorySearchInput(e.target.value)}
                  placeholder="e.g. client@example.com, builder@gmail.com"
                  className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#FAE008]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchHistory()}
                />
                <Button 
                  onClick={handleSearchHistory} 
                  disabled={isSearchingHistory || !historySearchInput.trim()}
                  size="sm"
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {isSearchingHistory ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Email Composer */}
      {composerMode && (
        <EmailComposer
          mode={composerMode?.type || composerMode}
          thread={composerMode?.thread || emailThread}
          message={selectedMessage}
          existingDraft={editingDraft}
          onClose={() => {
            setComposerMode(null);
            setSelectedMessage(null);
            setEditingDraft(null);
          }}
          onSent={handleEmailSent}
          onDraftSaved={handleDraftSaved}
          defaultTo={composerMode?.type === 'compose' ? project.customer_email : undefined}
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
          {/* Show each thread (linked + virtual) */}
          {displayThreads.map((thread) => {
            const threadMessages = displayMessages
              .filter(m => m.thread_id === thread.id)
              .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
            
            // Skip threads with no messages (shouldn't happen often)
            if (threadMessages.length === 0 && !thread.isVirtual) return null;

            return (
              <Card key={thread.id} className={`border border-[#E5E7EB] shadow-sm rounded-lg ${thread.isVirtual ? 'bg-slate-50/30' : ''}`}>
                <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] bg-transparent">
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
                        {thread.isVirtual && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-[10px] ml-1">
                            Historical Only
                          </Badge>
                        )}
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
                      {!thread.isVirtual && (
                        <>
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
                        </>
                      )}
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

                  {/* Messages for this thread */}
                  {threadMessages.length === 0 ? (
                    <p className="text-[14px] text-[#6B7280] text-center py-4">No messages in this thread yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {threadMessages.map((message, index) => {
                        // Debug: Log attachment data
                        if (message.attachments?.length > 0) {
                          console.log(`Message ${message.id} attachments:`, message.attachments.map(a => ({
                            filename: a.filename,
                            has_attachment_id: !!a.attachment_id,
                            has_gmail_message_id: !!a.gmail_message_id,
                            message_gmail_id: message.gmail_message_id
                          })));
                        }
                        return (
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
                        );
                      })}
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

      {/* Gmail History Search Modal */}
      <GmailHistorySearch
        open={showGmailHistoryModal}
        onClose={() => {
          setShowGmailHistoryModal(false);
          // Refresh threads after closing modal
          setRefreshKey(k => k + 1);
        }}
        projectId={project.id}
      />
    </div>
  );
}

// Sub-component for linking email threads
function LinkEmailThreadModal({ open, onClose, threads, onSelect, isLinking }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredThreads = threads.filter(thread => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      thread.subject?.toLowerCase().includes(searchLower) ||
      thread.from_address?.toLowerCase().includes(searchLower) ||
      thread.to_addresses?.some(addr => addr.toLowerCase().includes(searchLower)) ||
      thread.last_message_snippet?.toLowerCase().includes(searchLower)
    );
  }).slice(0, 30);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="text-[18px] font-semibold text-[#111827] mb-3">Link Email Thread</h3>
          <p className="text-[13px] text-[#6B7280] mb-3">
            Search by email address, subject, or sender to find threads
          </p>
          <input
            type="text"
            placeholder="Search by email address, subject, or sender..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#FAE008] text-[14px]"
            autoFocus
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredThreads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#6B7280] mb-2">
                {searchTerm ? 'No threads found matching your search' : 'Loading threads...'}
              </p>
              {searchTerm && (
                <p className="text-[12px] text-[#9CA3AF]">
                  Try searching by email address or subject
                </p>
              )}
            </div>
          ) : (
            filteredThreads.map(thread => {
              const isAlreadyLinked = thread.linked_project_id;
              return (
                <div
                  key={thread.id}
                  onClick={() => !isLinking && onSelect(thread.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    isAlreadyLinked 
                      ? 'border-amber-200 bg-amber-50 hover:border-amber-300' 
                      : 'border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]'
                  } ${isLinking ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-[14px] font-semibold text-[#111827] truncate flex-1">
                      {thread.subject || '(No subject)'}
                    </h4>
                    {isAlreadyLinked && (
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full flex-shrink-0">
                        Linked
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#6B7280]">
                    From: {thread.from_address}
                  </p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1">
                    {thread.message_count || 0} message{(thread.message_count || 0) !== 1 ? 's' : ''} • {thread.last_message_date ? new Date(thread.last_message_date).toLocaleDateString() : ''}
                  </p>
                  {isAlreadyLinked && thread.linked_project_title && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Currently linked to: {thread.linked_project_title}
                    </p>
                  )}
                </div>
              );
            })
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