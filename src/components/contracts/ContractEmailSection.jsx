import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Mail, LinkIcon, ExternalLink, Reply } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import EmailMessageView from "../inbox/EmailMessageView";
import UnifiedEmailComposer from "../inbox/UnifiedEmailComposer";
import LinkEmailThreadModal from "../projects/LinkEmailThreadModal";

export default function ContractEmailSection({ contract, onThreadLinked }) {
  const queryClient = useQueryClient();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [composerMode, setComposerMode] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Load user for permission checks
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity
  });

  // Fetch threads linked to this contract
  const { data: linkedThreads = [], isLoading: threadLoading, refetch: refetchThreads } = useQuery({
    queryKey: ['contractEmailThreads', contract.id],
    queryFn: async () => {
      const threads = await base44.entities.EmailThread.filter({ 
        contract_id: contract.id 
      }, '-last_message_date');
      return threads;
    },
    enabled: !!contract.id,
    staleTime: 0,
    refetchOnMount: true
  });

  // Fetch messages for linked threads
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['contractEmailMessages', contract.id, linkedThreads.map(t => t.id).join(',')],
    queryFn: async () => {
      if (linkedThreads.length === 0) return [];
      const allMessages = [];
      for (const thread of linkedThreads) {
        const threadMessages = await base44.entities.EmailMessage.filter({ 
          thread_id: thread.id 
        }, 'sent_at');
        allMessages.push(...threadMessages);
      }
      return allMessages;
    },
    enabled: linkedThreads.length > 0
  });

  // Link thread mutation
  const linkThreadMutation = useMutation({
    mutationFn: async (threadId) => {
      await base44.entities.EmailThread.update(threadId, {
        contract_id: contract.id,
        linked_to_contract_at: new Date().toISOString(),
        linked_to_contract_by: currentUser.email
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contractEmailThreads', contract.id] });
      await queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['myEmailThreads'] });
      await queryClient.refetchQueries({ queryKey: ['contractEmailThreads', contract.id] });
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
      const canUnlink = currentUser?.role === 'admin' || currentUser?.extended_role === 'manager';
      if (!canUnlink) {
        throw new Error('Insufficient permissions to unlink threads');
      }
      await base44.entities.EmailThread.update(threadId, {
        contract_id: null,
        contract_name: null,
        contract_status: null,
        contract_type: null,
        linked_to_contract_at: null,
        linked_to_contract_by: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractEmailThreads', contract.id] });
      toast.success('Email thread unlinked');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to unlink thread');
    }
  });

  const handleReply = (message, thread) => {
    setSelectedMessage(message);
    setComposerMode({ type: 'reply', thread: thread });
  };

  const handleEmailSent = async () => {
    setComposerMode(null);
    setSelectedMessage(null);
    await queryClient.invalidateQueries({ queryKey: ['contractEmailThreads', contract.id] });
    await queryClient.invalidateQueries({ queryKey: ['contractEmailMessages', contract.id] });
    await queryClient.refetchQueries({ queryKey: ['contractEmailThreads', contract.id] });
    await refetchMessages();
  };

  const isLoading = threadLoading || messagesLoading;
  const canUnlink = currentUser?.role === 'admin' || currentUser?.extended_role === 'manager';
  const canReply = currentUser?.role !== 'viewer';

  // No linked threads - show option to link
  if (linkedThreads.length === 0) {
    return (
      <div className="text-center py-6">
        <Mail className="w-10 h-10 text-[#E5E7EB] mx-auto mb-3" />
        <h3 className="text-[15px] font-medium text-[#111827] mb-1">No Emails</h3>
        <p className="text-[13px] text-[#6B7280] mb-4">
          Link an email thread to view communications.
        </p>
        <Button
          onClick={() => setShowLinkModal(true)}
          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          Link Email Thread
        </Button>

        <LinkEmailThreadModal
          open={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          contractId={contract.id}
          onLink={(threadId) => linkThreadMutation.mutate(threadId)}
          isLinking={linkThreadMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      {composerMode && (
        <UnifiedEmailComposer
          variant="inline"
          mode={composerMode.type || composerMode}
          thread={composerMode.thread || null}
          message={selectedMessage}
          linkTarget={{ type: "contract", id: contract.id, name: contract.name }}
          onClose={() => {
            setComposerMode(null);
            setSelectedMessage(null);
          }}
          onSent={handleEmailSent}
        />
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-[#F3F4F6] rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-[#F3F4F6] rounded w-2/3"></div>
            </div>
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
              <div key={thread.id} className="border-b border-[#E5E7EB] pb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#111827] truncate">
                      {thread.subject || 'Email Thread'}
                    </h3>
                    <p className="text-[12px] text-[#6B7280]">{threadMessages.length} messages</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(createPageUrl('Inbox') + `?threadId=${thread.id}`, '_blank')}
                      className="h-7 w-7 p-0"
                      title="Open in Inbox"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    {canUnlink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlinkThreadMutation.mutate(thread.id)}
                        className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={unlinkThreadMutation.isPending}
                      >
                        Unlink
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reply button */}
                {canReply && threadMessages.length > 0 && (
                  <Button
                    onClick={() => handleReply(threadMessages[threadMessages.length - 1], thread)}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 mb-3 text-[12px]"
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    Reply
                  </Button>
                )}

                {/* Messages */}
                <div className="space-y-2">
                  {threadMessages.map((message) => (
                    <div key={message.id}>
                      <EmailMessageView
                        message={message}
                        isFirst={true}
                        linkedContractId={contract.id}
                        threadSubject={thread.subject}
                        gmailMessageId={message.gmail_message_id}
                        onReply={canReply ? handleReply : null}
                        thread={thread}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Button to link more threads */}
          <Button
            variant="ghost"
            onClick={() => setShowLinkModal(true)}
            className="w-full text-[13px] text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] border border-dashed border-[#E5E7EB]"
          >
            <LinkIcon className="w-3.5 h-3.5 mr-2" />
            Link Another Email Thread
          </Button>
        </>
      )}

      {/* Link Thread Modal */}
      <LinkEmailThreadModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        contractId={contract.id}
        onLink={(threadId) => linkThreadMutation.mutate(threadId)}
        isLinking={linkThreadMutation.isPending}
      />
    </div>
  );
}