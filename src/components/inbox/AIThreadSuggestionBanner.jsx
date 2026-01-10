import React from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shouldShowAISuggestion } from "@/components/utils/emailThreadLinkingStates";

/**
 * AIThreadSuggestionBanner - Non-blocking AI suggestion display
 * Shows when AI has suggested action and it hasn't been dismissed
 */
export default function AIThreadSuggestionBanner({ 
  thread, 
  onDismiss,
  onCreateProject,
  onCreateJob,
  onLinkProject
}) {
  if (!shouldShowAISuggestion(thread)) return null;

  const actionLabel = {
    'create_project': 'Create Project',
    'link_project': 'Link to Project',
    'link_job': 'Link to Job',
    'none': null
  }[thread.ai_suggested_action];

  if (!actionLabel) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 flex-1">
        <Sparkles className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-yellow-900 mb-1">AI Suggestion</h3>
          <p className="text-sm text-yellow-800 mb-2">
            {thread.ai_suggested_action === 'create_project' && 
              "AI suggests creating a new project from this email."}
            {thread.ai_suggested_action === 'link_project' && 
              `AI suggests linking to project: ${thread.ai_suggested_project_id}`}
            {thread.ai_suggested_action === 'link_job' && 
              "AI suggests linking to an existing job."}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {thread.ai_suggested_action === 'create_project' && (
              <Button
                size="sm"
                onClick={onCreateProject}
                className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs h-8 px-3"
              >
                Create Project
              </Button>
            )}
            {thread.ai_suggested_action === 'link_project' && (
              <Button
                size="sm"
                onClick={onLinkProject}
                className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs h-8 px-3"
              >
                Link to Project
              </Button>
            )}
            {thread.ai_priority && (
              <Badge 
                variant="secondary" 
                className="text-xs h-6"
              >
                {thread.ai_priority} priority
              </Badge>
            )}
            {thread.ai_category && (
              <Badge 
                variant="secondary" 
                className="text-xs h-6"
              >
                {thread.ai_category}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-yellow-600 hover:text-yellow-700 flex-shrink-0 mt-0.5"
        title="Dismiss suggestion"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}