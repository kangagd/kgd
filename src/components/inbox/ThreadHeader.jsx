import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, User, Clock, Check, Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ThreadHeader({ thread, users = [], onStatusChange, onAssignChange, loading = false }) {
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);

  const statusOptions = ['Open', 'Waiting on Customer', 'Internal', 'Closed'];

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  return (
    <div className="bg-white border-b border-[#E5E7EB] p-4 space-y-3">
      {/* Subject */}
      <div>
        <h2 className="text-[18px] font-semibold text-[#111827]">{thread.subject}</h2>
        {(thread.customer_name || thread.project_title) && (
          <div className="text-[13px] text-[#6B7280] mt-1">
            {thread.customer_name && <span>{thread.customer_name}</span>}
            {thread.project_title && (
              <span className="ml-2">• {thread.project_title}</span>
            )}
            {thread.job_number && (
              <span className="ml-2">• Job #{thread.job_number}</span>
            )}
          </div>
        )}
      </div>

      {/* Status & Owner Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Dropdown */}
        <Select value={thread.status || 'Open'} onValueChange={onStatusChange} disabled={loading}>
          <SelectTrigger className="w-[180px]">
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

        {/* Owner Assignment */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[#6B7280]">Assigned to:</span>
          {thread.assigned_to ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#FAE008]/20 flex items-center justify-center border border-[#FAE008]/30">
                <span className="text-[11px] font-semibold text-[#111827]">
                  {getInitials(thread.assigned_to_name || thread.assigned_to)}
                </span>
              </div>
              <select
                value={thread.assigned_to || ''}
                onChange={(e) => onAssignChange(e.target.value || null)}
                className="text-[13px] px-2 py-1 rounded border border-[#E5E7EB] hover:border-[#D1D5DB]"
                disabled={loading}
              >
                <option value="">Unassign</option>
                {users.map(user => (
                  <option key={user.id || user.email} value={user.email}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <select
              onChange={(e) => onAssignChange(e.target.value || null)}
              className="text-[13px] px-2 py-1.5 rounded border border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] hover:border-[#D1D5DB]"
              disabled={loading}
              defaultValue=""
            >
              <option value="">Assign to someone...</option>
              {users.map(user => (
                <option key={user.id || user.email} value={user.email}>
                  {user.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-[12px] text-[#6B7280] pt-2 border-t border-[#F3F4F6]">
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
        {thread.is_read && (
          <div className="flex items-center gap-1 text-green-600">
            <Check className="w-3.5 h-3.5" />
            <span>Read</span>
          </div>
        )}
      </div>
    </div>
  );
}