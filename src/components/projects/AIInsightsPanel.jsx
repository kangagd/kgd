import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { createPageUrl } from "@/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AIInsightsPanel({ project, onApplySuggestion, onRefresh }) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [appliedFields, setAppliedFields] = useState({});
  const [confirmDialog, setConfirmDialog] = useState(null);

  const hasAiData = project?.ai_email_summary || project?.ai_key_requirements;

  // Fetch linked email thread details
  const { data: emailThread } = useQuery({
    queryKey: ['emailThread', project?.ai_source_email_thread_id],
    queryFn: () => base44.entities.EmailThread.filter({ id: project.ai_source_email_thread_id }),
    enabled: !!project?.ai_source_email_thread_id,
    select: (data) => data[0]
  });

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
        toast.success('AI insights refreshed from email');
        setAppliedFields({});
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error refreshing AI insights:', error);
      toast.error('Failed to refresh AI insights');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApplyField = (field, value, currentValue) => {
    // Check if field already has a value
    if (currentValue && currentValue !== value) {
      setConfirmDialog({ field, value, currentValue });
    } else {
      applyField(field, value);
    }
  };

  const applyField = (field, value) => {
    onApplySuggestion?.(field, value);
    setAppliedFields(prev => ({ ...prev, [field]: true }));
    toast.success(`Applied ${getFieldLabel(field)}`);
    setConfirmDialog(null);
  };

  const getFieldLabel = (field) => {
    const labels = {
      project_type: 'Project Type',
      status: 'Project Stage',
      description: 'Description',
      address_full: 'Address',
      customer_name: 'Customer Name',
      customer_phone: 'Phone',
      customer_email: 'Email'
    };
    return labels[field] || field;
  };

  const handleViewEmailThread = () => {
    if (project?.ai_source_email_thread_id) {
      navigate(createPageUrl("Inbox") + `?threadId=${project.ai_source_email_thread_id}`);
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

  // Build list of field suggestions
  const fieldSuggestions = [];
  
  if (project.ai_suggested_project_type && project.ai_suggested_project_type !== project.project_type) {
    fieldSuggestions.push({
      field: 'project_type',
      label: 'Project Type',
      value: project.ai_suggested_project_type,
      currentValue: project.project_type
    });
  }
  
  if (project.ai_suggested_stage && project.ai_suggested_stage !== project.status) {
    fieldSuggestions.push({
      field: 'status',
      label: 'Project Stage',
      value: project.ai_suggested_stage,
      currentValue: project.status
    });
  }
  
  if (keyReqs.site_address && keyReqs.site_address !== project.address_full) {
    fieldSuggestions.push({
      field: 'address_full',
      label: 'Address',
      value: keyReqs.site_address,
      currentValue: project.address_full
    });
  }
  
  if (keyReqs.project_description && keyReqs.project_description !== project.description) {
    fieldSuggestions.push({
      field: 'description',
      label: 'Description',
      value: keyReqs.project_description,
      currentValue: project.description
    });
  }

  return (
    <>
      <Card className="border-l-4 border-l-purple-500 border-purple-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-[#111827]">AI Summary from Email</h3>
                  <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] px-1.5 py-0">
                    AI
                  </Badge>
                </div>
                <p className="text-[11px] text-[#6B7280]">Generated from the linked email thread</p>
              </div>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-[#6B7280] ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6B7280] ml-2" />
              )}
            </button>
            
            <div className="flex items-center gap-2">
              {project.ai_source_email_thread_id && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleViewEmailThread}
                    className="h-8 px-2 text-[12px] text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                  >
                    <Mail className="w-3.5 h-3.5 mr-1" />
                    View Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-8 px-3 text-[12px] border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh from Email
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {expanded && (
          <CardContent className="p-4 space-y-4">
            {/* Summary Section */}
            {project.ai_email_summary && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide">Summary</span>
                </div>
                <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                  <p className="text-[13px] text-[#111827] leading-relaxed">
                    {project.ai_email_summary}
                  </p>
                </div>
              </div>
            )}

            {/* Key Details Section */}
            {Object.keys(keyReqs).length > 0 && (
              <div className="space-y-2">
                <span className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide">Key Details</span>
                <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB] space-y-2">
                  {keyReqs.project_description && (
                    <div className="flex items-start gap-2">
                      <span className="text-[12px] text-[#6B7280] min-w-[100px]">Request:</span>
                      <span className="text-[12px] text-[#111827]">{keyReqs.project_description}</span>
                    </div>
                  )}
                  {keyReqs.priority && keyReqs.priority !== 'Normal' && (
                    <div className="flex items-start gap-2">
                      <span className="text-[12px] text-[#6B7280] min-w-[100px]">Urgency:</span>
                      <Badge className={`${getPriorityColor(keyReqs.priority)} text-[11px] px-2 py-0`}>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {keyReqs.priority}
                      </Badge>
                    </div>
                  )}
                  {keyReqs.requested_timeframe && (
                    <div className="flex items-start gap-2">
                      <span className="text-[12px] text-[#6B7280] min-w-[100px]">Timeframe:</span>
                      <span className="text-[12px] text-[#111827]">{keyReqs.requested_timeframe}</span>
                    </div>
                  )}
                  {keyReqs.customer_phone && (
                    <div className="flex items-start gap-2">
                      <span className="text-[12px] text-[#6B7280] min-w-[100px]">Phone:</span>
                      <span className="text-[12px] text-[#111827]">{keyReqs.customer_phone}</span>
                    </div>
                  )}
                  {keyReqs.site_address && (
                    <div className="flex items-start gap-2">
                      <span className="text-[12px] text-[#6B7280] min-w-[100px]">Address:</span>
                      <span className="text-[12px] text-[#111827]">{keyReqs.site_address}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Suggested Field Applications */}
            {fieldSuggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide">
                    Suggested Updates
                  </span>
                  {fieldSuggestions.filter(s => !appliedFields[s.field]).length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        fieldSuggestions.forEach(s => {
                          if (!appliedFields[s.field]) {
                            applyField(s.field, s.value);
                          }
                        });
                      }}
                      className="h-7 text-[11px] text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Apply All
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {fieldSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.field}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        appliedFields[suggestion.field]
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-[#E5E7EB] hover:border-purple-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[#6B7280] uppercase font-medium">{suggestion.label}</div>
                        <div className="text-[13px] text-[#111827] truncate">{suggestion.value}</div>
                      </div>
                      {appliedFields[suggestion.field] ? (
                        <div className="flex items-center gap-1 text-green-600 text-[12px] font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Applied
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyField(suggestion.field, suggestion.value, suggestion.currentValue)}
                          className="h-7 px-3 text-[11px] border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300"
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] text-[11px] text-[#9CA3AF]">
              <div className="flex items-center gap-3">
                {project.ai_last_updated_at && (
                  <span>Last updated: {format(parseISO(project.ai_last_updated_at), 'MMM d, h:mm a')}</span>
                )}
                {emailThread?.subject && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Source: {emailThread.subject.substring(0, 40)}{emailThread.subject.length > 40 ? '...' : ''}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Confirm Overwrite Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing value?</AlertDialogTitle>
            <AlertDialogDescription>
              This field already has a value. Do you want to replace it with the AI suggestion?
              <div className="mt-3 space-y-2">
                <div className="p-2 bg-[#F9FAFB] rounded border border-[#E5E7EB]">
                  <div className="text-[11px] text-[#6B7280] uppercase">Current</div>
                  <div className="text-[13px] text-[#111827]">{confirmDialog?.currentValue}</div>
                </div>
                <div className="p-2 bg-purple-50 rounded border border-purple-200">
                  <div className="text-[11px] text-purple-600 uppercase">Suggested</div>
                  <div className="text-[13px] text-[#111827]">{confirmDialog?.value}</div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => applyField(confirmDialog.field, confirmDialog.value)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}