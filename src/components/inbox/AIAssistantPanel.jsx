import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Building2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Briefcase,
  FolderKanban
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AIAssistantPanel({ 
  thread, 
  selectedMessage, 
  onCreateProject, 
  onCreateJob,
  onRefresh 
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    insights: true,
    details: true,
    actions: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleReprocess = async () => {
    setIsProcessing(true);
    try {
      await base44.functions.invoke('processEmailAI', { 
        thread_id: thread.id,
        message_id: selectedMessage?.id 
      });
      toast.success('AI processing complete');
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Failed to process email');
    } finally {
      setIsProcessing(false);
    }
  };

  const getImportanceLevel = (score) => {
    if (!score) return { label: 'Normal', color: 'bg-gray-100 text-gray-800' };
    if (score >= 0.7) return { label: 'High', color: 'bg-red-100 text-red-800' };
    if (score >= 0.4) return { label: 'Normal', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Low', color: 'bg-gray-100 text-gray-600' };
  };

  const getSentimentColor = (sentiment) => {
    const colors = {
      positive: 'bg-green-100 text-green-800',
      neutral: 'bg-gray-100 text-gray-800',
      negative: 'bg-red-100 text-red-800',
      mixed: 'bg-yellow-100 text-yellow-800',
      unknown: 'bg-gray-100 text-gray-600'
    };
    return colors[sentiment] || colors.unknown;
  };

  const handleActionClick = (action) => {
    if (action.type === 'create_project') {
      onCreateProject();
    } else if (action.type === 'create_job') {
      onCreateJob();
    } else {
      toast.info(`Action: ${action.reason}`);
    }
  };

  const importance = getImportanceLevel(selectedMessage?.ai_importance_score || thread?.ai_importance_score);
  const entities = selectedMessage?.ai_extracted_entities || {};

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FA] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FAE008] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#111827]" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#111827]">AI Assistant</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReprocess}
          disabled={isProcessing}
          className="h-8"
        >
          <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Thread Summary */}
      {thread?.ai_thread_summary && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FAE008]" />
                Thread Summary
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('summary')}
                className="h-6 w-6 p-0"
              >
                {expandedSections.summary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
            <Badge className="text-[10px] bg-purple-100 text-purple-800 border-0 w-fit">
              AI-generated
            </Badge>
          </CardHeader>
          {expandedSections.summary && (
            <CardContent className="pt-0 space-y-3">
              <p className="text-[13px] text-[#111827] leading-relaxed">
                {thread.ai_thread_summary}
              </p>
              {thread.ai_thread_key_points?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-[#6B7280] uppercase">Key Points</p>
                  <ul className="space-y-1.5">
                    {thread.ai_thread_key_points.map((point, idx) => (
                      <li key={idx} className="text-[12px] text-[#111827] flex items-start gap-2">
                        <span className="text-[#FAE008] mt-1">•</span>
                        <span className="flex-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Current Message Insights */}
      {selectedMessage && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                Message Insights
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('insights')}
                className="h-6 w-6 p-0"
              >
                {expandedSections.insights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`text-[11px] ${getSentimentColor(selectedMessage.ai_sentiment)} border-0`}>
                {selectedMessage.ai_sentiment || 'unknown'}
              </Badge>
              <Badge className={`text-[11px] ${importance.color} border-0`}>
                {importance.label} Priority
              </Badge>
            </div>
          </CardHeader>
          {expandedSections.insights && (
            <CardContent className="pt-0 space-y-3">
              {selectedMessage.ai_summary && (
                <p className="text-[13px] text-[#111827] leading-relaxed">
                  {selectedMessage.ai_summary}
                </p>
              )}
              {selectedMessage.ai_key_points?.length > 0 && (
                <ul className="space-y-1.5">
                  {selectedMessage.ai_key_points.map((point, idx) => (
                    <li key={idx} className="text-[12px] text-[#111827] flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span className="flex-1">{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Extracted Details */}
      {entities && Object.keys(entities).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-semibold">Key Details</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('details')}
                className="h-6 w-6 p-0"
              >
                {expandedSections.details ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.details && (
            <CardContent className="pt-0 space-y-2">
              {entities.contact_name && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase font-semibold">Contact</p>
                    <p className="text-[13px] text-[#111827]">{entities.contact_name}</p>
                  </div>
                </div>
              )}
              {entities.phone_numbers?.length > 0 && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase font-semibold">Phone</p>
                    {entities.phone_numbers.map((phone, idx) => (
                      <p key={idx} className="text-[13px] text-[#111827]">{phone}</p>
                    ))}
                  </div>
                </div>
              )}
              {entities.addresses?.length > 0 && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase font-semibold">Address</p>
                    {entities.addresses.map((addr, idx) => (
                      <p key={idx} className="text-[13px] text-[#111827]">{addr}</p>
                    ))}
                  </div>
                </div>
              )}
              {entities.requested_dates?.length > 0 && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase font-semibold">Requested Dates</p>
                    {entities.requested_dates.map((date, idx) => (
                      <p key={idx} className="text-[13px] text-[#111827]">{date}</p>
                    ))}
                  </div>
                </div>
              )}
              {entities.budget_mentions?.length > 0 && (
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase font-semibold">Budget</p>
                    {entities.budget_mentions.map((budget, idx) => (
                      <p key={idx} className="text-[13px] text-[#111827]">{budget}</p>
                    ))}
                  </div>
                </div>
              )}
              {entities.company_name && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#6B7280] uppercase font-semibold">Company</p>
                    <p className="text-[13px] text-[#111827]">{entities.company_name}</p>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Suggested Actions */}
      {selectedMessage?.ai_suggested_actions?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-semibold">Suggested Actions</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('actions')}
                className="h-6 w-6 p-0"
              >
                {expandedSections.actions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.actions && (
            <CardContent className="pt-0 space-y-2">
              {selectedMessage.ai_suggested_actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleActionClick(action)}
                  className="w-full justify-start text-left h-auto py-2 px-3"
                >
                  <div className="flex items-start gap-2 w-full">
                    {action.type === 'create_project' && <FolderKanban className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {action.type === 'create_job' && <Briefcase className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {action.type === 'follow_up_email' && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#111827]">
                        {action.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">{action.reason}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* No AI Data Message */}
      {!thread?.ai_thread_summary && !selectedMessage?.ai_summary && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
            <p className="text-[13px] text-[#6B7280] mb-3">
              AI insights not yet available
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Generate Insights'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}