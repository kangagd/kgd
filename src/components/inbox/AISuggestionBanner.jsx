import { useState } from "react";
import { Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSuggested, canDismissSuggestion } from "@/components/domain/threadLinkingHelpers";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AISuggestionBanner({ thread, onActionTaken, onDismiss }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const suggested = isSuggested(thread);
  const canDismiss = canDismissSuggestion(thread);

  if (!suggested || !canDismiss) return null;

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await base44.entities.EmailThread.update(thread.id, {
        ai_suggestion_rejected_at: new Date().toISOString()
      });
      toast.success("Suggestion dismissed");
      onDismiss?.();
    } catch (error) {
      toast.error("Failed to dismiss suggestion");
    } finally {
      setIsDismissing(false);
    }
  };

  const handleAccept = () => {
    onActionTaken?.("accept");
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-amber-900 text-[14px]">
                AI Suggestion
              </h3>
              {thread.ai_suggested_action && (
                <span className="text-[12px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  {thread.ai_suggested_action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              )}
            </div>
            <p className="text-[13px] text-amber-800 mb-2">
              AI detected this email might be related to an existing project.
            </p>
            
            {isExpanded && (
              <div className="space-y-2 mb-3 text-[13px]">
                {thread.ai_category && (
                  <div className="flex gap-2">
                    <span className="text-amber-700 font-medium">Category:</span>
                    <span className="text-amber-900">{thread.ai_category}</span>
                  </div>
                )}
                {thread.ai_priority && (
                  <div className="flex gap-2">
                    <span className="text-amber-700 font-medium">Priority:</span>
                    <span className="text-amber-900">{thread.ai_priority}</span>
                  </div>
                )}
                {thread.ai_overview && (
                  <div className="flex gap-2 flex-col">
                    <span className="text-amber-700 font-medium">Summary:</span>
                    <p className="text-amber-900 italic">{thread.ai_overview}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="bg-amber-600 hover:bg-amber-700 text-white text-[12px] h-8"
          >
            Review
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            disabled={isDismissing}
            className="h-8 w-8"
            title="Dismiss suggestion"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}