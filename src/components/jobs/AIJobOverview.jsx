import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Copy, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export default function AIJobOverview({ job, user, onGenerate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const isTechnician = user?.is_field_technician;
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    // Collapsible default for technicians on small screens
    if (isTechnician && window.innerWidth < 768) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isTechnician]);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('generateJobAISummary', { job_id: job.id });
      if (response.data && response.data.success) {
        toast.success("AI Summary generated successfully");
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

  const handleCopy = () => {
    if (job.ai_summary) {
        // Strip quotes if it's a JSON stringified string
        let textToCopy = job.ai_summary;
        try {
             if (textToCopy.startsWith('"') && textToCopy.endsWith('"')) {
                 textToCopy = JSON.parse(textToCopy);
             }
        } catch (e) {
            // ignore
        }
        
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Format summary for display - handle potential double JSON stringification
  const displaySummary = React.useMemo(() => {
      if (!job.ai_summary) return null;
      try {
          // Sometimes integration returns "string", sometimes stringified JSON
          const parsed = JSON.parse(job.ai_summary);
          return typeof parsed === 'string' ? parsed : job.ai_summary;
      } catch {
          return job.ai_summary;
      }
  }, [job.ai_summary]);

  return (
    <Card className="mb-6 border-[#E5E7EB] shadow-sm bg-white overflow-hidden">
      <div 
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="bg-yellow-100 p-1.5 rounded-md">
            <Sparkles className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">AI Quick Overview</h3>
            <p className="text-xs text-slate-500 hidden md:block">Key requirements and site context</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-4 animate-in slide-in-from-top-2 duration-200">
          {isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[80%]" />
            </div>
          ) : (
            <>
              {displaySummary ? (
                <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <ReactMarkdown>{displaySummary}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-3">No summary generated yet</p>
                  <Button onClick={(e) => { e.stopPropagation(); handleGenerate(); }} size="sm" className="bg-[#FAE008] text-slate-900 hover:bg-[#E5CF07]">
                    <Zap className="w-3.5 h-3.5 mr-2" />
                    Generate Summary
                  </Button>
                </div>
              )}

              {displaySummary && (
                <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
                  {isAdminOrManager && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                        className="text-slate-500 hover:text-slate-900 h-8"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Regenerate
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                    className="h-8 bg-white"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    {isCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}