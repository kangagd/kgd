import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LinkIcon, Sparkles, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '@/utils';

export default function InboxV2ContextPanel({
  thread,
  teamUsers = [],
  onThreadUpdate,
  onOpenLinkModal,
  onOpenCreateProjectModal,
}) {
  const queryClient = useQueryClient();
  const [linkingInProgress, setLinkingInProgress] = useState(false);

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-4">
        <div>
          <LinkIcon className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
          <p className="text-[13px] text-[#6B7280]">Select a thread to triage</p>
        </div>
      </div>
    );
  }

  const isLinked = thread.project_id || thread.contract_id;
  const linkedType = thread.project_id ? 'project' : thread.contract_id ? 'contract' : null;
  const linkedTitle = thread.project_title || thread.contract_name || '';
  const isClosed = thread.userStatus === 'closed';
  const canonicalStatus = isClosed ? 'done' : thread.next_action_status || 'needs_action';

  // Assignment mutation
  const assignmentMutation = useMutation({
    mutationFn: async (userEmail) => {
      await base44.functions.invoke('assignEmailThread', {
        thread_id: thread.id,
        assigned_to_user_email: userEmail || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      onThreadUpdate?.();
      toast.success(thread.assigned_to ? 'Owner changed' : 'Owner assigned');
    },
    onError: () => toast.error('Failed to assign thread'),
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async (status) => {
      await base44.entities.EmailThread.update(thread.id, {
        next_action_status: status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      onThreadUpdate?.();
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Done/Reopen mutation
  const closeMutation = useMutation({
    mutationFn: async (shouldClose) => {
      if (shouldClose) {
        await base44.entities.EmailThread.update(thread.id, { userStatus: 'closed' });
      } else {
        await base44.entities.EmailThread.update(thread.id, {
          userStatus: null,
          next_action_status: 'needs_action',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      onThreadUpdate?.();
      toast.success(isClosed ? 'Reopened' : 'Marked as Done');
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto space-y-3 p-4">
      {/* Triage Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
        <div className="text-sm font-semibold text-blue-900">Quick Triage</div>

        {/* Link Section */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Link to Project</div>
          {isLinked ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 text-xs">
                {linkedType}: {linkedTitle}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenLinkModal}
                className="h-6 px-2 text-xs text-blue-700 hover:bg-blue-100"
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={onOpenLinkModal}
                className="flex-1 h-7 text-xs bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
                variant="outline"
              >
                <LinkIcon className="w-3 h-3 mr-1" />
                Link Project
              </Button>
              <Button
                onClick={onOpenCreateProjectModal}
                className="flex-1 h-7 text-xs bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
                variant="outline"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Create
              </Button>
            </div>
          )}
        </div>

        {/* Owner Section */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Owner</div>
          <Select
            value={thread.assigned_to || ''}
            onValueChange={(email) => assignmentMutation.mutate(email || null)}
            disabled={assignmentMutation.isPending}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Unassigned</SelectItem>
              {teamUsers.map((user) => (
                <SelectItem key={user.email} value={user.email}>
                  {user.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Next Action Section */}
        {!isClosed && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#6B7280]">Next Action</div>
            <div className="flex gap-1 flex-wrap">
              {['needs_action', 'waiting', 'fyi'].map((status) => (
                <Button
                  key={status}
                  onClick={() => statusMutation.mutate(status)}
                  disabled={statusMutation.isPending}
                  className={`flex-1 h-7 text-xs transition-colors ${
                    canonicalStatus === status
                      ? 'bg-[#FAE008] text-[#111827]'
                      : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
                  }`}
                  variant="outline"
                >
                  {status === 'needs_action' ? 'Needs Action' : status === 'waiting' ? 'Waiting' : 'FYI'}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Done/Reopen Section */}
        <div className="flex gap-2">
          {isClosed ? (
            <Button
              onClick={() => closeMutation.mutate(false)}
              disabled={closeMutation.isPending}
              className="flex-1 h-7 text-xs bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              variant="outline"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reopen
            </Button>
          ) : (
            <Button
              onClick={() => closeMutation.mutate(true)}
              disabled={closeMutation.isPending}
              className="flex-1 h-7 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
              variant="outline"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark Done
            </Button>
          )}
        </div>
      </div>

      {/* Original linked entity view (below triage) */}
      {thread.project_id && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Project Details</div>
          <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] space-y-2">
            <div className="text-sm font-semibold text-[#111827]">{thread.project_title || 'Project'}</div>
            {thread.project_number && (
              <div className="text-xs text-[#6B7280]">#{thread.project_number}</div>
            )}
            {thread.customer_name && (
              <div className="text-xs text-[#4B5563]">{thread.customer_name}</div>
            )}
            <Button
              onClick={() => (window.location.href = createPageUrl('Projects') + `?projectId=${thread.project_id}`)}
              className="w-full mt-3 h-7 text-xs bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              Open Project
            </Button>
          </div>
        </div>
      )}

      {thread.contract_id && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#6B7280]">Contract Details</div>
          <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F9FAFB] space-y-2">
            <div className="text-sm font-semibold text-[#111827]">{thread.contract_name || 'Contract'}</div>
            {thread.contract_status && (
              <div className="text-xs text-[#6B7280]">{thread.contract_status}</div>
            )}
            <Button
              onClick={() => (window.location.href = createPageUrl('Contracts') + `?contractId=${thread.contract_id}`)}
              className="w-full mt-3 h-7 text-xs bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              Open Contract
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}