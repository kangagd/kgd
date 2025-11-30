import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Bot, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { format, parseISO } from "date-fns";

export default function AIProjectOverview({ project, user, onGenerate }) {
  const [isLoading, setIsLoading] = useState(false);
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('generateProjectAISummary', { project_id: project.id });
      if (response.data && response.data.success) {
        toast.success("Project Overview generated successfully");
        if (onGenerate) onGenerate();
      } else {
        throw new Error(response.data?.error || "Failed to generate summary");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate AI summary");
    } finally {
      setIsLoading(false);
    }
  };

  const displaySummary = React.useMemo(() => {
      if (!project.ai_project_overview) return null;
      try {
          const parsed = JSON.parse(project.ai_project_overview);
          return typeof parsed === 'string' ? parsed : project.ai_project_overview;
      } catch {
          return project.ai_project_overview;
      }
  }, [project.ai_project_overview]);

  return (
    <div className="space-y-4">
      <Card className="border-indigo-100 bg-white shadow-sm">
        <CardHeader className="pb-2 pt-4 px-6 flex flex-row items-center justify-between space-y-0 border-b border-indigo-50 bg-indigo-50/30">
            <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-1.5 rounded-md">
                    <Bot className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <CardTitle className="text-base font-semibold text-indigo-900">AI Project Overview</CardTitle>
                    <p className="text-xs text-indigo-500">Automated status report & risk analysis</p>
                </div>
            </div>
            {isAdminOrManager && (
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={handleGenerate}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {project.ai_project_overview ? "Regenerate Report" : "Generate Report"}
                </Button>
            )}
        </CardHeader>
        <CardContent className="p-6">
            {isLoading && !project.ai_project_overview ? (
                <div className="flex flex-col items-center justify-center py-12 text-indigo-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                    <p>Analyzing project data...</p>
                    <p className="text-xs text-indigo-300 mt-1">Checking jobs, parts, quotes, and emails</p>
                </div>
            ) : displaySummary ? (
                <div className="space-y-4">
                    <div className="prose prose-sm max-w-none prose-indigo text-slate-700">
                        <ReactMarkdown>{displaySummary}</ReactMarkdown>
                    </div>
                    <div className="text-[11px] text-indigo-400 text-right pt-4 border-t border-indigo-50">
                        Last updated: {project.ai_last_generated_at ? format(parseISO(project.ai_last_generated_at), "MMM d, yyyy h:mm a") : "Just now"}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-slate-900 mb-1">No Overview Available</h3>
                    <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">
                        Generate an AI summary to get a comprehensive status report, risk analysis, and next steps.
                    </p>
                    {isAdminOrManager && (
                        <Button onClick={handleGenerate} className="bg-indigo-600 text-white hover:bg-indigo-700">
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Overview
                        </Button>
                    )}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}