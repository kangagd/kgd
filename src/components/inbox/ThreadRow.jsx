import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Mail, AlertCircle, LinkIcon, Sparkles, Pin } from "lucide-react";
import { getThreadLinkingState } from "@/components/utils/emailThreadLinkingStates";
import { getThreadStatusChip, isThreadPinned, getThreadLinkChip } from "@/components/inbox/threadStatusChip";

export default function ThreadRow({ thread, isSelected, onClick }) {
  const linkingState = getThreadLinkingState(thread);
  const statusChip = getThreadStatusChip(thread);
  const isPinned = isThreadPinned(thread);
  const linkChip = getThreadLinkChip(thread);

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 text-left border-b border-[#E5E7EB] transition-all ${
        isSelected 
          ? 'bg-[#FAE008]/10 border-l-2 border-l-[#FAE008]' 
          : 'hover:bg-[#F9FAFB]'
      }`}
    >
      <div className="space-y-2">
        {/* Subject & Chips (Status, Pin, Link) */}
         <div className="flex items-start justify-between gap-2 mb-2">
           <h3 className="text-[14px] font-semibold text-[#111827] flex-1 truncate">
             {thread.subject}
           </h3>
           <div className="flex items-center gap-1 flex-wrap flex-shrink-0 justify-end">
             {/* Status Chip (single, priority-based) */}
             {statusChip && (
               <Badge 
                 variant="outline" 
                 className={`text-[11px] border ${statusChip.color}`}
               >
                 {statusChip.label}
               </Badge>
             )}

             {/* Pin Indicator (separate from status) */}
             {isPinned && (
               <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px]">
                 <Pin className="w-3 h-3" />
                 <span>Pinned</span>
               </div>
             )}

             {/* Link Chip (separate from status/pin) */}
             {linkChip && (
               <Badge className="text-[10px] h-5 bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                 <LinkIcon className="w-3 h-3" />
                 {linkChip.type === 'project' ? 'Project' : 'Job'}: {linkChip.title}
               </Badge>
             )}

             {/* Fallback linking states from old system (can be removed after migration) */}
             {linkingState.isSuggested && (
               <Badge className="text-[10px] h-5 bg-yellow-100 text-yellow-700 border-yellow-200 flex items-center gap-1">
                 <Sparkles className="w-3 h-3" />
                 Suggested
               </Badge>
             )}
             {linkingState.isIgnored && (
               <Badge className="text-[10px] h-5 bg-slate-100 text-slate-600 border-slate-200">
                 Dismissed
               </Badge>
             )}
           </div>
         </div>

        {/* Project Link - if linked */}
         {linkingState.isLinked && linkingState.linkedProjectTitle && (
           <div className="flex items-center gap-1 text-[12px] mb-2 flex-wrap">
             <LinkIcon className="w-3 h-3 text-[#6B7280] flex-shrink-0" />
             <span className="text-[#111827] font-medium truncate max-w-[220px]">
               #{linkingState.linkedProjectNumber} {linkingState.linkedProjectTitle}
             </span>
           </div>
         )}

         {/* Customer, Project/Job, Last Activity */}
         <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
           {thread.customer_name && (
             <span className="truncate">{thread.customer_name}</span>
           )}
           {(thread.job_number && !linkingState.isLinked) && (
             <>
               <span>•</span>
               <span className="truncate">Job #{thread.job_number}</span>
             </>
           )}
         </div>

        {/* Owner & Last Message Preview */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#9CA3AF] truncate">
              {thread.last_message_snippet || 'No messages'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {thread.assigned_to && (
              <div 
                className="w-6 h-6 rounded-full bg-[#FAE008]/20 flex items-center justify-center border border-[#FAE008]/30 flex-shrink-0"
                title={thread.assigned_to_name}
              >
                <span className="text-[10px] font-semibold text-[#111827]">
                  {getInitials(thread.assigned_to_name)}
                </span>
              </div>
            )}
            {!thread.is_read && (
              <div className="w-2 h-2 bg-[#FAE008] rounded-full flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Last Message Date */}
        <div className="text-[11px] text-[#9CA3AF]">
          {thread.last_message_date && format(parseISO(thread.last_message_date), 'MMM d, h:mm a')}
        </div>
      </div>
    </button>
  );
}