import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from "@/utils";
import { ChevronDown, User, Clock, Check, Mail, X, Link as LinkIcon, Sparkles, FileText, Trash2, Reply, ArrowRight, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { computeInferredStateWithAutoClear } from '@/components/inbox/inferredStateAutoClear';
import { closeThread, reopenThread } from '@/components/inbox/threadCloseActions';
import LinkThreadModal from './LinkThreadModal';
import CreateProjectFromEmailModal from './CreateProjectFromEmailModal';
import { devLog } from "@/components/utils/devLog";
import ThreadInternalNotesModal from './ThreadInternalNotesModal';
import DeleteThreadConfirmModal from './DeleteThreadConfirmModal';

export default function ThreadHeader({ 
  thread, 
  users = [], 
  onStatusChange, 
  onAssignChange, 
  loading = false, 
  currentUser, 
  onThreadUpdate,
  hasMessages = false,
  onReply = null,
  onReplyAll = null,
  onForward = null,
  onAttach = null,
  compactMode = false
}) {
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [isClosingLoading, setIsClosingLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [linkClickTimer, setLinkClickTimer] = useState(null);

  const statusOptions = ['Open', 'Waiting on Customer', 'Internal', 'Closed'];
  const nextActionOptions = [
    { value: 'needs_action', label: 'Needs Action' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'fyi', label: 'FYI' },
  ];

  const displayState = computeInferredStateWithAutoClear(thread);
  const isClosed = thread.userStatus === 'closed';
  
  // Canonical status from explicit workflow fields
  const canonicalStatus = isClosed ? 'done' : thread.next_action_status || 'needs_action';

  const handleCloseToggle = async () => {
    if (!currentUser) return;
    
    setIsClosingLoading(true);
    try {
      if (isClosed) {
        await reopenThread(thread.id, currentUser.id);
      } else {
        await closeThread(thread.id, currentUser.id);
      }
      onThreadUpdate?.();
    } finally {
      setIsClosingLoading(false);
    }
  };

  const handleNextActionStatusChange = async (status) => {
    try {
      await base44.entities.EmailThread.update(thread.id, {
        next_action_status: status
      });
      onThreadUpdate?.();
      toast.success(`Status changed to ${nextActionOptions.find(o => o.value === status)?.label}`);
    } catch (error) {
      devLog('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleMarkDone = async () => {
    try {
      await base44.entities.EmailThread.update(thread.id, {
        userStatus: 'closed'
      });
      onThreadUpdate?.();
      toast.success('Marked as Done');
    } catch (error) {
      devLog('Failed to mark done:', error);
      toast.error('Failed to mark as done');
    }
  };

  const handleReopen = async () => {
    try {
      await base44.entities.EmailThread.update(thread.id, {
        userStatus: null,
        next_action_status: 'needs_action'
      });
      onThreadUpdate?.();
      toast.success('Reopened');
    } catch (error) {
      devLog('Failed to reopen:', error);
      toast.error('Failed to reopen');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const isViewer = currentUser?.role === 'viewer';
  const canCompose = !isViewer;
  const canReplyForward = canCompose && (hasMessages || thread.gmail_thread_id);
  const isLinked = thread.project_id || thread.contract_id;
  const linkedType = thread.project_id ? 'project' : thread.contract_id ? 'contract' : null;
  const linkedTitle = thread.project_title || thread.contract_name || '';

  const handleLinkProject = async (projectId) => {
    try {
      await base44.functions.invoke('linkEmailThreadToProject', {
        email_thread_id: thread.id,
        project_id: projectId,
      });
      setShowLinkModal(false);
      onThreadUpdate?.();
    } catch (error) {
      devLog('Failed to link:', error);
      toast.error('Failed to link thread to project');
    }
  };

  const handleLinkContract = async (contractId) => {
    try {
      await base44.functions.invoke('linkEmailThreadToContract', {
        email_thread_id: thread.id,
        contract_id: contractId,
      });
      setShowLinkModal(false);
      onThreadUpdate?.();
    } catch (error) {
      devLog('Failed to link:', error);
      toast.error('Failed to link thread to contract');
    }
  };

  const handleUnlink = async () => {
    try {
      await base44.entities.EmailThread.update(thread.id, {
        project_id: null,
        project_number: null,
        project_title: null,
        linked_to_project_at: null,
        linked_to_project_by: null,
        contract_id: null,
        contract_name: null,
        contract_status: null,
        contract_type: null,
      });
      setShowLinkModal(false);
      onThreadUpdate?.();
    } catch (error) {
      devLog('Failed to unlink:', error);
    }
  };

  const handleDeleted = () => {
    onThreadUpdate?.();
  };

  const handleLinkButtonClick = (e) => {
    if (!isLinked) {
      setShowLinkModal(true);
      return;
    }

    // Clear any existing timer
    if (linkClickTimer) clearTimeout(linkClickTimer);

    // Set a timer to detect double-click
      const timer = setTimeout(() => {
        // Single click - navigate to project/contract
        const url = linkedType === 'project' 
          ? createPageUrl("Projects") + `?projectId=${thread.project_id}`
          : createPageUrl("Contracts") + `?contractId=${thread.contract_id}`;
        window.location.href = url;
        setLinkClickTimer(null);
      }, 300);

    setLinkClickTimer(timer);
  };

  const handleLinkButtonDoubleClick = (e) => {
    e.preventDefault();
    // Clear timer to prevent single-click action
    if (linkClickTimer) clearTimeout(linkClickTimer);
    setLinkClickTimer(null);
    
    // Unlink
    if (isLinked) {
      handleUnlink();
      toast.success('Link removed');
    }
  };

  return (
    <div className="bg-white border-b border-[#E5E7EB] p-4 space-y-3">
      {/* Row 1: Subject + Action Rail */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-semibold text-[#111827] truncate">{thread.subject}</h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Reply */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onReply}
            disabled={!canReplyForward}
            className="h-7 px-2 text-[12px] flex items-center gap-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            title={!canReplyForward ? (isViewer ? 'Viewer cannot reply' : 'Sync this thread to reply') : 'Reply to sender'}
          >
            <Reply className="w-3.5 h-3.5" />
            Reply
          </Button>

          {/* Forward */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onForward}
            disabled={!canReplyForward}
            className="h-7 px-2 text-[12px] flex items-center gap-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            title={!canReplyForward ? (isViewer ? 'Viewer cannot forward' : 'Sync this thread to forward') : 'Forward this thread'}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Forward
          </Button>

          {/* Attach */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onAttach}
            disabled={!canCompose}
            className="h-7 px-2 text-[12px] flex items-center gap-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            title={!canCompose ? 'Viewer cannot compose' : 'Compose with attachments'}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attach
          </Button>

          {/* Link Action */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLinkButtonClick}
            onDoubleClick={handleLinkButtonDoubleClick}
            disabled={isViewer}
            className={`h-7 px-2 text-[12px] flex items-center gap-1 ${
              isLinked
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'text-[#6B7280] hover:bg-[#F3F4F6]'
            }`}
            title={isViewer 
              ? 'Viewer cannot link' 
              : isLinked 
                ? `${linkedType === 'project' ? 'Project' : 'Contract'} - double-click to unlink`
                : 'Link to Project or Contract'}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            {isLinked ? `${linkedType === 'project' ? 'Project' : 'Contract'}` : 'Link'}
          </Button>

          {/* Create Project (disabled if already linked) */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCreateProjectModal(true)}
            disabled={isViewer || !!thread.project_id}
            className="h-7 px-2 text-[12px] flex items-center gap-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            title={thread.project_id ? 'Already linked to project' : 'Create project from this email'}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Button>

          {/* Internal Notes */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNotesModal(true)}
            disabled={isViewer}
            className="h-7 px-2 text-[12px] flex items-center gap-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            title={isViewer ? 'Viewer cannot edit notes' : 'Add internal notes'}
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>

          {/* Delete */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDeleteModal(true)}
            disabled={isViewer}
            className="h-7 px-2 text-[12px] flex items-center gap-1 text-red-600 hover:bg-red-50"
            title={isViewer ? 'Viewer cannot delete' : 'Delete thread'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Row 2: Status Controls + Metadata */}
      <div className="space-y-3">
        {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Next Action Status Dropdown (workflow) */}
            {currentUser && !isClosed && (
              <Select value={canonicalStatus} onValueChange={handleNextActionStatusChange} disabled={loading}>
                <SelectTrigger className="w-[140px] h-7 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nextActionOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Mark Done / Reopen */}
            {currentUser && (
              <Button
                onClick={isClosed ? handleReopen : handleMarkDone}
                disabled={isClosingLoading}
                className={`h-7 px-3 text-[12px] flex items-center gap-1 ${
                  isClosed 
                    ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200' 
                    : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                }`}
                variant="outline"
              >
                <Check className="w-3 h-3" />
                {isClosed ? 'Reopen' : 'Done'}
              </Button>
            )}

          {/* Owner Assignment */}
          <div className="flex items-center gap-2">
            {thread.assigned_to ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#FAE008]/20 flex items-center justify-center border border-[#FAE008]/30">
                  <span className="text-[10px] font-semibold text-[#111827]">
                    {getInitials(thread.assigned_to_name)}
                  </span>
                </div>
                <select
                  value={thread.assigned_to || ''}
                  onChange={(e) => onAssignChange(e.target.value || null)}
                  className="text-[12px] px-2 py-0.5 rounded border border-[#E5E7EB] hover:border-[#D1D5DB]"
                  disabled={loading}
                >
                  <option value="">Unassign</option>
                  {users.map(user => (
                    <option key={user.id || user.email} value={user.email}>
                      {user.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <select
                onChange={(e) => onAssignChange(e.target.value || null)}
                className="text-[12px] px-2 py-1 rounded border border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] hover:border-[#D1D5DB]"
                disabled={loading}
                defaultValue=""
              >
                <option value="">Assign to...</option>
                {users.map(user => (
                  <option key={user.id || user.email} value={user.email}>
                    {user.display_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-[11px] text-[#6B7280] pt-2 border-t border-[#F3F4F6]">
          {thread.message_count && (
          <div className="flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            <span>{thread.message_count} messages</span>
          </div>
        )}
        {thread.last_message_date && (
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{format(parseISO(thread.last_message_date), 'MMM d, yyyy')}</span>
          </div>
        )}
        {thread.viewers && thread.viewers.length > 0 && (
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-green-600" />
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B7280]">Read by:</span>
              <div className="flex -space-x-1.5">
                {thread.viewers.slice(0, 3).map((viewer, idx) => (
                  <div
                    key={idx}
                    className="w-5 h-5 rounded-full bg-green-100 border border-white flex items-center justify-center"
                    title={viewer.user_name || viewer.user_email}
                  >
                    <span className="text-[9px] font-semibold text-green-700">
                       {(viewer.user_name?.split(' ').map(n => n[0]).join('') || '?').toUpperCase()}
                     </span>
                  </div>
                ))}
                {thread.viewers.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-gray-200 border border-white flex items-center justify-center">
                    <span className="text-[9px] font-semibold text-gray-700">+{thread.viewers.length - 3}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Modals */}
      <LinkThreadModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLinkProject={handleLinkProject}
        onLinkContract={handleLinkContract}
        onUnlink={isLinked ? handleUnlink : null}
        currentlyLinkedType={linkedType}
        currentlyLinkedTitle={linkedTitle}
      />

      <CreateProjectFromEmailModal
        open={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        thread={thread}
        emailMessage={null}
        onSuccess={() => onThreadUpdate?.()}
      />

      <ThreadInternalNotesModal
        open={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        thread={thread}
        onSaved={onThreadUpdate}
      />

      <DeleteThreadConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        thread={thread}
        onDeleted={handleDeleted}
      />
    </div>
  );
}