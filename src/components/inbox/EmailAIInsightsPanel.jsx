import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertCircle, Link as LinkIcon } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function EmailAIInsightsPanel({ thread, onThreadUpdated, onCreateProjectFromAI }) {
  const [loading, setLoading] = useState(false);
  const [localThread, setLocalThread] = useState(thread);

  const effectiveThread = localThread || thread;

  const handleRunAI = async () => {
    if (!thread?.id) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("processEmailThreadWithAI", {
        email_thread_id: thread.id,
      });
      
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      
      const updated = res.data?.thread || res.data;
      setLocalThread(updated);
      if (onThreadUpdated) onThreadUpdated(updated);
      toast.success("AI insights generated successfully");
    } catch (err) {
      console.error("Error running email AI", err);
      toast.error("Failed to run AI on this email");
    } finally {
      setLoading(false);
    }
  };

  const t = effectiveThread;

  const hasInsights =
    !!t?.ai_overview ||
    (Array.isArray(t?.ai_labels) && t.ai_labels.length > 0) ||
    !!t?.ai_category ||
    !!t?.ai_priority;

  const projectLink = t?.ai_suggested_links?.project_id;
  const jobLink = t?.ai_suggested_links?.job_id;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 py-3 px-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/50 to-blue-50/50">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Insights
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Summarize, categorize, and get suggestions for this email
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
          disabled={loading}
          onClick={handleRunAI}
        >
          {loading ? (
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
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {!hasInsights && !loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            <span>No AI insights yet. Click "Run AI" to analyze this email.</span>
          </div>
        )}

        {t?.ai_overview && (
          <div className="text-sm">
            <p className="font-medium text-xs text-slate-500 mb-1.5">Overview</p>
            <p className="text-slate-800 leading-relaxed">{t.ai_overview}</p>
          </div>
        )}

        {Array.isArray(t?.ai_key_points) && t.ai_key_points.length > 0 && (
          <div>
            <p className="font-medium text-xs text-slate-500 mb-1.5">Key Points</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
              {t.ai_key_points.map((kp, idx) => (
                <li key={idx} className="leading-relaxed">{kp}</li>
              ))}
            </ul>
          </div>
        )}

        {(t?.ai_labels || t?.ai_priority || t?.ai_category) && (
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

        {(projectLink || jobLink) && (
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}