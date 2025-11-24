import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function AIInsightsPanel({ project, onApplySuggestion, onRefresh }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const hasAiData = project?.ai_email_summary || project?.ai_key_requirements;

  const handleRefresh = async () => {
    if (!project?.ai_source_email_thread_id) {
      toast.error('No linked email thread to refresh from');
      return;
    }

    setIsRefreshing(true);
    try {
      const result = await base44.functions.invoke('extractProjectFromEmail', {
        threadId: project.ai_source_email_thread_id,
        projectId: project.id
      });

      if (result.data?.success) {
        toast.success('AI insights refreshed');
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error refreshing AI insights:', error);
      toast.error('Failed to refresh AI insights');
    } finally {
      setIsRefreshing(false);
    }
  };

  const parseKeyRequirements = () => {
    try {
      return JSON.parse(project.ai_key_requirements || '{}');
    } catch {
      return {};
    }
  };

  const keyReqs = parseKeyRequirements();

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!hasAiData && !project?.ai_source_email_thread_id) {
    return null;
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <CardTitle className="text-[16px] text-purple-800">AI Insights</CardTitle>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-purple-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-purple-600" />
            )}
          </button>
          <div className="flex items-center gap-2">
            {project.ai_last_updated_at && (
              <span className="text-[11px] text-purple-500">
                Updated {format(parseISO(project.ai_last_updated_at), 'MMM d, h:mm a')}
              </span>
            )}
            {project.ai_source_email_thread_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-7 px-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-2 space-y-4">
          {/* Summary */}
          {project.ai_email_summary && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 text-purple-500" />
                <span className="text-[12px] font-medium text-purple-600 uppercase">Email Summary</span>
              </div>
              <p className="text-[13px] text-purple-800 leading-relaxed bg-white/60 rounded-lg p-3 border border-purple-100">
                {project.ai_email_summary}
              </p>
            </div>
          )}

          {/* Key Requirements */}
          {Object.keys(keyReqs).length > 0 && (
            <div className="space-y-2">
              <span className="text-[12px] font-medium text-purple-600 uppercase">Extracted Details</span>
              <div className="grid grid-cols-2 gap-2">
                {keyReqs.customer_name && (
                  <SuggestionCard
                    label="Customer"
                    value={keyReqs.customer_name}
                    onApply={() => onApplySuggestion?.('customer_name', keyReqs.customer_name)}
                  />
                )}
                {keyReqs.customer_phone && (
                  <SuggestionCard
                    label="Phone"
                    value={keyReqs.customer_phone}
                    onApply={() => onApplySuggestion?.('customer_phone', keyReqs.customer_phone)}
                  />
                )}
                {keyReqs.site_address && (
                  <SuggestionCard
                    label="Address"
                    value={keyReqs.site_address}
                    onApply={() => onApplySuggestion?.('address_full', keyReqs.site_address)}
                    className="col-span-2"
                  />
                )}
                {keyReqs.project_description && (
                  <SuggestionCard
                    label="Description"
                    value={keyReqs.project_description}
                    onApply={() => onApplySuggestion?.('description', keyReqs.project_description)}
                    className="col-span-2"
                  />
                )}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-200">
            {project.ai_suggested_project_type && project.ai_suggested_project_type !== project.project_type && (
              <button
                onClick={() => onApplySuggestion?.('project_type', project.ai_suggested_project_type)}
                className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-[11px]"
              >
                <Check className="w-3 h-3 text-purple-600" />
                <span className="text-purple-600">Type:</span>
                <span className="text-purple-800 font-medium">{project.ai_suggested_project_type}</span>
              </button>
            )}
            {project.ai_suggested_stage && project.ai_suggested_stage !== project.status && (
              <button
                onClick={() => onApplySuggestion?.('status', project.ai_suggested_stage)}
                className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-[11px]"
              >
                <Check className="w-3 h-3 text-purple-600" />
                <span className="text-purple-600">Stage:</span>
                <span className="text-purple-800 font-medium">{project.ai_suggested_stage}</span>
              </button>
            )}
            {keyReqs.priority && keyReqs.priority !== 'Normal' && (
              <Badge className={getPriorityColor(keyReqs.priority)}>
                <AlertCircle className="w-3 h-3 mr-1" />
                {keyReqs.priority} Priority
              </Badge>
            )}
            {keyReqs.requested_timeframe && (
              <Badge variant="outline" className="border-purple-200 text-purple-700">
                Timeframe: {keyReqs.requested_timeframe}
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SuggestionCard({ label, value, onApply, className = "" }) {
  return (
    <button
      onClick={onApply}
      className={`flex items-start gap-2 p-2 text-left bg-white rounded-lg border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-colors ${className}`}
    >
      <Check className="w-3 h-3 text-purple-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-purple-500 uppercase font-medium">{label}</div>
        <div className="text-[12px] text-purple-800 break-words">{value}</div>
      </div>
    </button>
  );
}