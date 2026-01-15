import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, User, Clock, Check, Mail, X, Link as LinkIcon, Sparkles, FileText, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { computeInferredStateWithAutoClear } from '@/components/inbox/inferredStateAutoClear';
import { closeThread, reopenThread } from '@/components/inbox/threadCloseActions';
import LinkThreadModal from './LinkThreadModal';
import CreateProjectFromThreadModal from './CreateProjectFromThreadModal';
import ThreadInternalNotesModal from './ThreadInternalNotesModal';
import DeleteThreadConfirmModal from './DeleteThreadConfirmModal';

export default function ThreadHeader({ thread, users = [], onStatusChange, onAssignChange, loading = false, currentUser, onThreadUpdate }) {
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [isClosingLoading, setIsClosingLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const statusOptions = ['Open', 'Waiting on Customer', 'Internal', 'Closed'];

  const displayState = computeInferredStateWithAutoClear(thread);
  const isClosed = thread.userStatus === 'closed';

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

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const isViewer = currentUser?.role === 'viewer';
  const isLinked = thread.project_id || thread.contract_id;
  const linkedType = thread.project_id ? 'project' : thread.contract_id ? 'contract' : null;
  const linkedTitle = thread.project_title || thread.contract_name || '';

  const handleLinkProject = async (projectId) => {
    try {
      await base44.functions.invoke('linkEmailThreadToProject', {
        threadId: thread.id,
        projectId,
      });
      setShowLinkModal(false);
      onThreadUpdate?.();
    } catch (error) {
      console.error('Failed to link:', error);
    }
  };

  const handleLinkContract = async (contractId) => {
    try {
      await base44.functions.invoke('linkEmailThreadToContract', {
        threadId: thread.id,
        contractId,
      });
      setShowLinkModal(false);
      onThreadUpdate?.();
    } catch (error) {
      console.error('Failed to link:', error);
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
      console.error('Failed to unlink:', error);
    }
  };

  const handleDeleted = () => {
    onThreadUpdate?.();
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
          {/* Link Action */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowLinkModal(true)}
            disabled={isViewer}
            className={`h-7 px-2 text-[12px] flex items-center gap-1 ${
              isLinked
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'text-[#6B7280] hover:bg-[#F3F4F6]'
            }`}
            title={isViewer ? 'Viewer cannot link' : 'Link to Project or Contract'}
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
          {/* Close/Reopen Button */}
          {currentUser && (
            <Button
              onClick={handleCloseToggle}
              disabled={isClosingLoading}
              className={`h-7 px-2 text-[12px] flex items-center gap-1 ${
                isClosed 
                  ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200' 
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
              }`}
              variant="outline"
            >
              <X className="w-3 h-3" />
              {isClosed ? 'Reopen' : 'Mark closed'}
            </Button>
          )}

          {/* Status Dropdown (only if not closed) */}
          {!isClosed && (
            <Select value={thread.status || 'Open'} onValueChange={onStatusChange} disabled={loading}>
              <SelectTrigger className="w-[160px] h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(status => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <CreateProjectFromThreadModal
        open={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        thread={thread}
        onCreated={onThreadUpdate}
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