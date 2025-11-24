import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Reply,
  Forward,
  ExternalLink as ExternalLinkIcon,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Copy,
  Link as LinkIcon,
  X,
  Trash2
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import EmailComposer from "./EmailComposer";
import ActionSuggestionBanner from "./ActionSuggestionBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const getFileIcon = (mimeType, filename) => {
  const name = filename?.toLowerCase() || '';
  const type = mimeType?.toLowerCase() || '';
  
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg)$/.test(name)) return ImageIcon;
  return FileText;
};

const sanitizeBodyHtml = (html) => {
  if (!html) return html;
  
  let sanitized = html;
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>.*?<\/form>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized;
};

const AIActionCard = ({ title, content, onCopy, onAction, actionLabel, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200/50 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h4 className="text-[14px] font-semibold text-[#111827]">{title}</h4>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 w-7 p-0"
          >
            {copied ? <span className="text-green-600 text-xs">✓</span> : <Copy className="w-3 h-3" />}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="text-[13px] text-[#111827] leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      {onAction && actionLabel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="mt-3 text-[12px] h-8"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default function EmailDetailView({
  thread,
  onClose,
  onLinkProject,
  onLinkJob,
  onUnlinkProject,
  onUnlinkJob,
  userPermissions,
  onDelete
}) {
  const [composerMode, setComposerMode] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showFullHeader, setShowFullHeader] = useState(false);
  const [aiCards, setAiCards] = useState([]);
  const [loadingAI, setLoadingAI] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ['emailMessages', thread.id],
    queryFn: () => base44.entities.EmailMessage.filter({ thread_id: thread.id }, 'sent_at'),
    refetchInterval: 30000
  });

  const latestMessage = messages[messages.length - 1];
  const allAttachments = messages.flatMap(m => m.attachments || []);

  const handleReply = () => {
    if (!latestMessage) return;
    setSelectedMessage(latestMessage);
    setComposerMode("reply");
  };

  const handleForward = () => {
    if (!latestMessage) return;
    setSelectedMessage(latestMessage);
    setComposerMode("forward");
  };

  const handleCloseComposer = () => {
    setComposerMode(null);
    setSelectedMessage(null);
  };

  const handleEmailSent = () => {
    refetch();
  };

  const handleAISummarize = async () => {
    setLoadingAI('summarize');
    try {
      const emailContent = messages.map(m => 
        `From: ${m.from_address}\nDate: ${format(parseISO(m.sent_at), 'PPP')}\n\n${m.body_text || m.body_html?.replace(/<[^>]*>/g, '').substring(0, 1000)}`
      ).join('\n\n---\n\n');

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Summarize this email thread in 2-3 clear sentences. Focus on key decisions, requests, and outcomes.\n\n${emailContent}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" }
          }
        }
      });

      setAiCards(prev => [{
        id: Date.now(),
        title: "Email Summary",
        content: response.summary,
        type: "summary"
      }, ...prev]);
    } catch (error) {
      toast.error("Failed to generate summary");
    } finally {
      setLoadingAI(null);
    }
  };

  const handleAIExtractActions = async () => {
    if (!latestMessage) return;
    setLoadingAI('actions');
    try {
      const emailContent = latestMessage.body_text || latestMessage.body_html?.replace(/<[^>]*>/g, '').substring(0, 1000);

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract action items from this email. List them as bullet points.\n\nEmail:\n${emailContent}`,
        response_json_schema: {
          type: "object",
          properties: {
            actions: { type: "string" }
          }
        }
      });

      setAiCards(prev => [{
        id: Date.now(),
        title: "Suggested Actions",
        content: response.actions,
        type: "actions"
      }, ...prev]);
    } catch (error) {
      toast.error("Failed to extract actions");
    } finally {
      setLoadingAI(null);
    }
  };

  const handleAISuggestLinks = async () => {
    if (!latestMessage) return;
    setLoadingAI('links');
    try {
      const emailContent = `Subject: ${thread.subject}\n\n${latestMessage.body_text || latestMessage.body_html?.replace(/<[^>]*>/g, '').substring(0, 800)}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this email from a garage door service company, suggest if it should be linked to an existing job or project. Provide reasoning.\n\n${emailContent}`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestion: { type: "string" }
          }
        }
      });

      setAiCards(prev => [{
        id: Date.now(),
        title: "Link Suggestions",
        content: response.suggestion,
        type: "links"
      }, ...prev]);
    } catch (error) {
      toast.error("Failed to generate link suggestions");
    } finally {
      setLoadingAI(null);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    setUpdatingPriority(true);
    try {
      await base44.entities.EmailThread.update(thread.id, { priority: newPriority });
      toast.success(`Priority updated to ${newPriority}`);
      refetch();
    } catch (error) {
      toast.error("Failed to update priority");
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleAIReprioritize = async () => {
    setUpdatingPriority(true);
    try {
      const response = await base44.functions.invoke('emailPrioritize', { threadId: thread.id });
      toast.success(`AI set priority to ${response.data.priority}`);
      refetch();
    } catch (error) {
      toast.error("Failed to analyze priority");
    } finally {
      setUpdatingPriority(false);
    }
  };

  const getSenderInitials = (name, email) => {
    if (name) {
      const parts = name.split(' ');
      return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name[0].toUpperCase();
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      {/* Centered Content Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
          {/* AI Suggested Action Banner */}
          <ActionSuggestionBanner thread={thread} />

          {/* Main Email Card */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden mb-6">
            {/* Header - Subject & Actions */}
            <div className="p-6 border-b border-[#E5E7EB]">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] leading-tight mb-2">
                    {thread.subject}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#6B7280]">
                    {(thread.linked_project_id || thread.linked_job_id) && (
                      <>
                        {thread.linked_project_id && (
                          <div className="flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" />
                            <span>Project:</span>
                            <a
                              href={createPageUrl("Projects") + `?projectId=${thread.linked_project_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#111827] font-medium hover:underline"
                            >
                              {thread.linked_project_title}
                            </a>
                          </div>
                        )}
                        {thread.linked_job_id && (
                          <div className="flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" />
                            <span>Job:</span>
                            <a
                              href={createPageUrl("Jobs") + `?jobId=${thread.linked_job_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#111827] font-medium hover:underline"
                            >
                              #{thread.linked_job_number}
                            </a>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[#6B7280]">Priority:</span>
                      <Select value={thread.priority || "Normal"} onValueChange={handlePriorityChange} disabled={updatingPriority}>
                        <SelectTrigger className="h-7 w-[120px] text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">🔴 High</SelectItem>
                          <SelectItem value="Normal">🟡 Normal</SelectItem>
                          <SelectItem value="Low">🟢 Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {userPermissions?.can_reply && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReply}
                        title="Reply"
                        className="h-9 w-9"
                      >
                        <Reply className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleForward}
                        title="Forward"
                        className="h-9 w-9"
                      >
                        <Forward className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this email thread?')) {
                            onDelete?.(thread.id);
                          }
                        }}
                        title="Delete"
                        className="h-9 w-9 hover:text-[#DC2626] hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {userPermissions?.can_link_to_project && (
                        <DropdownMenuItem onClick={onLinkProject}>
                          Link to Project
                        </DropdownMenuItem>
                      )}
                      {userPermissions?.can_link_to_job && (
                        <DropdownMenuItem onClick={onLinkJob}>
                          Link to Job
                        </DropdownMenuItem>
                      )}
                      {thread.linked_project_id && userPermissions?.can_link_to_project && (
                        <DropdownMenuItem onClick={onUnlinkProject}>
                          Unlink Project
                        </DropdownMenuItem>
                      )}
                      {thread.linked_job_id && userPermissions?.can_link_to_job && (
                        <DropdownMenuItem onClick={onUnlinkJob}>
                          Unlink Job
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleAIReprioritize} disabled={updatingPriority}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Re-prioritize
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 lg:hidden"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Email Metadata Row */}
              {latestMessage && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FAE008] flex items-center justify-center text-[#111827] font-semibold flex-shrink-0">
                    {getSenderInitials(latestMessage.from_name, latestMessage.from_address)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold text-[#111827]">
                        {latestMessage.from_name || latestMessage.from_address}
                      </span>
                      <span className="text-[13px] text-[#6B7280]">
                        &lt;{latestMessage.from_address}&gt;
                      </span>
                    </div>
                    <div className="text-[13px] text-[#6B7280] mt-1">
                      to {latestMessage.to_addresses?.join(', ') || thread.to_addresses?.join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[13px] text-[#6B7280]">
                      {latestMessage.sent_at && format(parseISO(latestMessage.sent_at), 'MMM d, h:mm a')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowFullHeader(!showFullHeader)}
                      className="h-6 w-6"
                    >
                      {showFullHeader ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Expanded Header Details */}
              {showFullHeader && latestMessage && (
                <div className="mt-4 pt-4 border-t border-[#F3F4F6] space-y-2 text-[13px]">
                  <div className="flex gap-2">
                    <span className="text-[#6B7280] font-medium min-w-[60px]">From:</span>
                    <span className="text-[#111827]">{latestMessage.from_address}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#6B7280] font-medium min-w-[60px]">To:</span>
                    <span className="text-[#111827]">{latestMessage.to_addresses?.join(', ')}</span>
                  </div>
                  {latestMessage.cc_addresses?.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-[#6B7280] font-medium min-w-[60px]">Cc:</span>
                      <span className="text-[#111827]">{latestMessage.cc_addresses.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-[#6B7280] font-medium min-w-[60px]">Date:</span>
                    <span className="text-[#111827]">
                      {latestMessage.sent_at && format(parseISO(latestMessage.sent_at), 'EEEE, MMMM d, yyyy at h:mm a')}
                    </span>
                  </div>
                  {latestMessage.message_id && (
                    <div className="flex gap-2">
                      <span className="text-[#6B7280] font-medium min-w-[60px]">Message ID:</span>
                      <span className="text-[#111827] break-all font-mono text-[11px]">{latestMessage.message_id}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Email Composer */}
            {composerMode && (
              <div className="px-6 py-4 border-b border-[#F3F4F6] bg-[#FAFBFC]">
                <EmailComposer
                  mode={composerMode}
                  thread={thread}
                  message={selectedMessage}
                  onClose={handleCloseComposer}
                  onSent={handleEmailSent}
                />
              </div>
            )}

            {/* Attachments Section */}
            {allAttachments.length > 0 && (
              <div className="px-6 pt-4 pb-4 border-b border-[#F3F4F6]">
                <button
                  onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                  className="flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity w-full"
                >
                  <Paperclip className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-[14px] font-semibold text-[#111827]">
                    Attachments ({allAttachments.length})
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${attachmentsExpanded ? 'rotate-180' : ''}`} />
                </button>
                {attachmentsExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allAttachments.map((attachment, idx) => {
                      const FileIcon = getFileIcon(attachment.mime_type, attachment.filename);
                      const isImage = attachment.mime_type?.startsWith('image/');
                      
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:shadow-sm transition-all cursor-pointer group"
                          onClick={() => isImage && setPreviewAttachment(attachment)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                            <FileIcon className="w-5 h-5 text-[#6B7280]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#111827] truncate">
                              {attachment.filename}
                            </p>
                            <p className="text-[11px] text-[#6B7280]">
                              {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : ''}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* AI Actions Section */}
            <div className="px-6 pt-4 pb-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="text-[14px] font-semibold text-[#111827]">AI Tools</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  onClick={handleAISummarize}
                  disabled={loadingAI === 'summarize'}
                  className="w-full"
                >
                  {loadingAI === 'summarize' ? 'Generating...' : 'Summarize Email'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAIExtractActions}
                  disabled={loadingAI === 'actions'}
                  className="w-full"
                >
                  {loadingAI === 'actions' ? 'Extracting...' : 'Extract Actions'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAISuggestLinks}
                  disabled={loadingAI === 'links'}
                  className="w-full"
                >
                  {loadingAI === 'links' ? 'Analyzing...' : 'Suggest Links'}
                </Button>
              </div>

              {/* AI Results Cards */}
              {aiCards.length > 0 && (
                <div className="space-y-3 mt-4">
                  {aiCards.map((card) => (
                    <AIActionCard
                      key={card.id}
                      title={card.title}
                      content={card.content}
                      onCopy={() => toast.success('Copied to clipboard')}
                      onClose={() => setAiCards(prev => prev.filter(c => c.id !== card.id))}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Email Body */}
            <div className="p-6">
              {latestMessage ? (
                latestMessage.body_html ? (
                  <div 
                    className="gmail-email-body prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(latestMessage.body_html) }} 
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-[14px] text-[#111827] leading-relaxed">
                    {latestMessage.body_text || '(No content)'}
                  </div>
                )
              ) : (
                <div className="text-[14px] text-[#6B7280] text-center py-8">
                  No messages in this thread
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewAttachment?.filename}</span>
              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a href={previewAttachment?.url} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" />
                </a>
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewAttachment?.mime_type?.startsWith('image/') && (
            <img
              src={previewAttachment.url}
              alt={previewAttachment.filename}
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}