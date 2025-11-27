import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw, Eye, Loader2, X, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AIEmailSuggestionsModal from "./AIEmailSuggestionsModal";

export default function AIEmailSuggestionsBanner({ 
  emailThreadId, 
  project, 
  onApplySuggestions 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [emailThread, setEmailThread] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    if (emailThreadId) {
      loadSuggestions();
    }
  }, [emailThreadId]);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('applyEmailInsightsToProject', {
        email_thread_id: emailThreadId,
        project_id: project?.id
      });

      if (response.data?.success) {
        setSuggestions(response.data.suggested_project_fields);
        setEmailThread(response.data.email_thread);
      } else if (response.data?.needs_analysis) {
        // No insights yet, generate them in the background
        generateInsightsInBackground();
      }
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateInsightsInBackground = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateEmailThreadInsights', {
        email_thread_id: emailThreadId
      });

      if (response.data?.success) {
        // Reload suggestions after generation
        await loadSuggestions();
        toast.success("AI analysis complete");
      }
    } catch (error) {
      console.error("Error generating insights:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefresh = async () => {
    setIsGenerating(true);
    try {
      await base44.functions.invoke('generateEmailThreadInsights', {
        email_thread_id: emailThreadId
      });
      await loadSuggestions();
      toast.success("AI suggestions refreshed");
    } catch (error) {
      toast.error("Failed to refresh suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!emailThreadId || dismissed) return null;

  if (isLoading) {
    return (
      <Card className="border border-[#E0E7FF] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#6366F1] animate-spin" />
            <span className="text-[14px] text-[#4B5563]">Loading AI suggestions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isGenerating && !suggestions) {
    return (
      <Card className="border border-[#E0E7FF] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#6366F1] animate-spin" />
            <span className="text-[14px] text-[#4B5563]">Analyzing email thread...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions) return null;

  // Minimized view
  if (minimized) {
    return (
      <>
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg border border-[#E0E7FF] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] hover:shadow-sm transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#6366F1]" />
          <span className="text-[13px] font-medium text-[#4338CA]">AI Suggestions</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#6366F1]/10 text-[#4338CA]">Click to expand</span>
        </button>

        <AIEmailSuggestionsModal
          open={showModal}
          onClose={() => setShowModal(false)}
          emailThread={emailThread}
          project={project}
          suggestions={suggestions}
          onApply={onApplySuggestions}
        />
      </>
    );
  }

  return (
    <>
      <Card className="border border-[#E0E7FF] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[#6366F1]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] font-semibold text-[#4338CA]">AI Suggestions from Email</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#6366F1]/10 text-[#4338CA]">AI</span>
                </div>
                <p className="text-[13px] text-[#4B5563] leading-relaxed">
                  {emailThread?.ai_summary ? (
                    <span className="line-clamp-2">{emailThread.ai_summary}</span>
                  ) : (
                    "AI has analysed the linked email thread and suggested updates for this project."
                  )}
                </p>
                {emailThread?.subject && (
                  <div className="flex items-center gap-1.5 mt-2 text-[12px] text-[#6B7280]">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{emailThread.subject}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="p-1 hover:bg-[#6366F1]/10 rounded transition-colors"
              title="Minimize"
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E0E7FF]">
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="h-8 text-[12px] bg-[#6366F1] hover:bg-[#4F46E5] text-white"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Review Suggestions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isGenerating}
              className="h-8 text-[12px] border-[#6366F1]/30 text-[#4338CA] hover:bg-[#6366F1]/10 hover:border-[#6366F1]"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh from Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <AIEmailSuggestionsModal
        open={showModal}
        onClose={() => setShowModal(false)}
        emailThread={emailThread}
        project={project}
        suggestions={suggestions}
        onApply={onApplySuggestions}
      />
    </>
  );
}