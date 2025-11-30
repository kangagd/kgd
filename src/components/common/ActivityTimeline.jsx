import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { History, User, ArrowRight, Edit, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ActivityTimeline({ entityType, entityId }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activityLog', entityType, entityId],
    queryFn: async () => {
        // Support filtering by entity_type and entity_id
        // Assuming schema allows filtering
        const logs = await base44.entities.ActivityLog.filter({ 
            entity_type: entityType, 
            entity_id: entityId 
        }, '-created_date'); 
        return logs;
    }
  });

  if (isLoading) {
      return <div className="p-4 text-center text-gray-500">Loading activity...</div>;
  }

  if (activities.length === 0) {
      return (
          <div className="p-8 text-center border rounded-lg bg-slate-50">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">No activity recorded yet</p>
          </div>
      );
  }

  const getIcon = (action) => {
      if (action === 'create') return <Plus className="w-4 h-4 text-green-600" />;
      if (action === 'delete') return <Trash2 className="w-4 h-4 text-red-600" />;
      return <Edit className="w-4 h-4 text-blue-600" />;
  };

  const formatDiff = (before, after) => {
      if (!before || !after) return null;
      
      const changes = [];
      Object.keys(after).forEach(key => {
          if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
              // Skip internal fields or large objects if needed
              if (['updated_date', 'updated_by', 'created_date'].includes(key)) return;
              changes.push({
                  field: key,
                  from: before[key],
                  to: after[key]
              });
          }
      });

      if (changes.length === 0) return null;

      return (
          <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 space-y-1">
              {changes.map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-600">
                      <span className="font-medium text-slate-700">{change.field}:</span>
                      <span className="line-through opacity-70 truncate max-w-[100px]">{String(change.from ?? 'null')}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-medium truncate max-w-[100px]">{String(change.to ?? 'null')}</span>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="space-y-4">
        {activities.map((log) => (
            <div key={log.id} className="flex gap-3 relative pb-4 last:pb-0">
                {/* Line */}
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 last:hidden" />
                
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 z-10">
                    {getIcon(log.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-slate-900">
                            {log.user_name || log.user_email || 'System'}
                        </span>
                        <span className="text-xs text-slate-500">
                            {format(parseISO(log.created_date), 'MMM d, h:mm a')}
                        </span>
                    </div>
                    
                    <p className="text-sm text-slate-600">
                        {log.details || `Performed ${log.action} on ${entityType}`}
                    </p>

                    {/* Changes diff */}
                    {log.action === 'update' && formatDiff(log.before_data, log.after_data)}
                </div>
            </div>
        ))}
    </div>
  );
}