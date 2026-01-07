import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertCircle, Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function EmailAIInsightsPanel({ thread, onThreadUpdated, onCreateProjectFromAI, onCreateJobFromAI }) {
  const threadId = thread?.id;

  // Auto-collapse if thread is linked or closed
  const shouldAutoCollapse = thread?.project_id || thread?.status === 'Closed' || thread?.status === 'Archived';
  const [isCollapsed, setIsCollapsed] = React.useState(shouldAutoCollapse);

  // Update collapsed state when thread changes
  React.useEffect(() => {
    if (shouldAutoCollapse) {
      setIsCollapsed(true);
    }
  }, [shouldAutoCollapse]);

  // Auto-fetch AI insights when thread changes
  const {
    data: aiData,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ["aiEmailInsights", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      if (!threadId) return null;

      const res = await base44.functions.invoke("processEmailThreadWithAI", {
        email_thread_id: threadId,
      });

      if (res.data?.error) {
        throw new Error(res.data.error);
      }

      return res.data?.thread || res.data;
    },
  });

  // Notify parent when AI data changes
  React.useEffect(() => {
    if (aiData && onThreadUpdated) {
      onThreadUpdated(aiData);
    }
  }, [aiData?.id, aiData?.ai_analyzed_at]);

  // Use AI data if available, otherwise fall back to thread prop
  const t = aiData || thread;

  const hasInsights =
    !!t?.ai_overview ||
    (Array.isArray(t?.ai_labels) && t.ai_labels.length > 0) ||
    !!t?.ai_category ||
    !!t?.ai_priority;

  const projectLink = t?.ai_suggested_links?.project_id;
  const jobLink = t?.ai_suggested_links?.job_id;

  const handleRerun = async () => {
    if (!threadId) return;
    try {
      await refetch();
      toast.success("AI insights regenerated successfully");
    } catch (err) {
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes("Rate limit")) {
        toast.error("Rate limit exceeded. Please wait a moment and try again.");
      } else {
        toast.error("Failed to regenerate AI insights");
      }
    }
  };

  const isRateLimitError = isError && error?.message?.includes("Rate limit");

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader 
        className="flex flex-row items-center justify-between gap-3 py-3 px-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/50 to-blue-50/50 cursor-pointer hover:bg-purple-50/70 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Insights
            {shouldAutoCollapse && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
                Auto-collapsed
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Summarize, categorize, and get suggestions for this email
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
            disabled={!threadId || isFetching}
            onClick={(e) => {
              e.stopPropagation();
              handleRerun();
            }}
          >
            {isFetching ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1" />
                Run AI
              </>
            )}
          </Button>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-4 space-y-4">
        {!threadId && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            <span>Select an email to see AI insights.</span>
          </div>
        )}

        {threadId && (isLoading || isFetching) && !hasInsights && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Analyzing email with AI...</span>
          </div>
        )}

        {threadId && isError && !hasInsights && (
          <div className="flex items-center gap-2 text-xs text-red-600 py-2">
            <AlertCircle className="w-4 h-4" />
            <span>
              {isRateLimitError 
                ? "Rate limit exceeded. Please wait a moment before trying again."
                : "Could not generate insights for this email. Try again."}
            </span>
          </div>
        )}

        {!hasInsights && !isLoading && !isFetching && !isError && threadId && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            <span>No AI insights yet. Click "Run AI" to analyze this email.</span>
          </div>
        )}

        {hasInsights && t?.ai_overview && (
          <div className="text-sm">
            <p className="font-medium text-xs text-slate-500 mb-1.5">Overview</p>
            <p className="text-slate-800 leading-relaxed">{t.ai_overview}</p>
          </div>
        )}

        {hasInsights && Array.isArray(t?.ai_key_points) && t.ai_key_points.length > 0 && (
          <div>
            <p className="font-medium text-xs text-slate-500 mb-1.5">Key Points</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
              {t.ai_key_points.map((kp, idx) => (
                <li key={idx} className="leading-relaxed">{kp}</li>
              ))}
            </ul>
          </div>
        )}

        {hasInsights && (t?.ai_labels || t?.ai_priority || t?.ai_category) && (
          <div className="space-y-1.5">
            <p className="font-medium text-xs text-slate-500 mb-1.5">Classification</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.isArray(t?.ai_labels) &&
                t.ai_labels.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border-slate-300"
                  >
                    {label}
                  </Badge>
                ))}
              {t?.ai_priority && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-200"
                >
                  Priority: {t.ai_priority}
                </Badge>
              )}
              {t?.ai_category && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border-blue-200"
                >
                  {t.ai_category}
                </Badge>
              )}
            </div>
          </div>
        )}

        {hasInsights && (projectLink || jobLink) && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="font-medium text-xs text-slate-500 mb-1.5">
              Suggested Links
            </p>
            <div className="flex flex-wrap gap-2">
              {projectLink && (
                <Link
                  to={`${createPageUrl("Projects")}?projectId=${projectLink}`}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 transition-colors no-underline"
                >
                  <LinkIcon className="w-3 h-3" />
                  View suggested project
                  {t.ai_suggested_links?.project_confidence && (
                    <span className="text-[10px] opacity-70">
                      ({Math.round(t.ai_suggested_links.project_confidence * 100)}%)
                    </span>
                  )}
                </Link>
              )}
              {jobLink && (
                <Link
                  to={`${createPageUrl("Jobs")}?jobId=${jobLink}`}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-800 transition-colors no-underline"
                >
                  <LinkIcon className="w-3 h-3" />
                  View suggested job
                  {t.ai_suggested_links?.job_confidence && (
                    <span className="text-[10px] opacity-70">
                      ({Math.round(t.ai_suggested_links.job_confidence * 100)}%)
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>
        )}

        {hasInsights && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs rounded-lg"
              onClick={() => {
                if (onCreateProjectFromAI) onCreateProjectFromAI();
              }}
            >
              Create Project from AI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs rounded-lg"
              onClick={() => {
                if (onCreateJobFromAI) onCreateJobFromAI();
              }}
            >
              Create Job from AI
            </Button>
          </div>
        )}
        </CardContent>
      )}
    </Card>
  );
}