import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X, Loader2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: "bg-red-50 border-red-200 text-red-900",
    iconColor: "text-red-600",
    badge: "bg-red-100 text-red-700"
  },
  important: {
    icon: AlertCircle,
    color: "bg-amber-50 border-amber-200 text-amber-900",
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700"
  },
  info: {
    icon: Info,
    color: "bg-blue-50 border-blue-200 text-blue-900",
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700"
  }
};

export default function AISuggestionsPanel({ entityType, entityId, onSuggestionsApplied }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const queryClient = useQueryClient();

  const detectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('detectAttentionItems', {
        entityType,
        entityId
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions);
        if (data.suggestions.length === 0) {
          toast.info('No attention items detected');
        } else {
          toast.success(`Found ${data.suggestions.length} AI suggestion(s)`);
        }
      }
    },
    onError: (error) => {
      toast.error('Failed to detect attention items');
    }
  });

  const approveMutation = useMutation({
    mutationFn: (suggestion) => base44.entities.AttentionItem.create({
      entity_type: entityType,
      entity_id: entityId,
      title: suggestion.title,
      body: suggestion.body,
      severity: suggestion.severity,
      audience: suggestion.audience,
      source: 'ai',
      ai_reason: suggestion.ai_reason,
      status: 'active'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems'] });
      if (onSuggestionsApplied) onSuggestionsApplied();
    }
  });

  const handleDetect = () => {
    setIsDetecting(true);
    detectMutation.mutate(undefined, {
      onSettled: () => setIsDetecting(false)
    });
  };

  const handleApprove = (suggestion, index) => {
    approveMutation.mutate(suggestion, {
      onSuccess: () => {
        setSuggestions(prev => prev.filter((_, i) => i !== index));
        toast.success('Attention item created');
      }
    });
  };

  const handleDismiss = (index) => {
    setDismissed(prev => new Set([...prev, index]));
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  const visibleSuggestions = suggestions.filter((_, i) => !dismissed.has(i));

  return (
    <div className="space-y-3">
      {visibleSuggestions.length === 0 ? (
        <Button
          onClick={handleDetect}
          disabled={isDetecting}
          variant="outline"
          size="sm"
          className="gap-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        >
          {isDetecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isDetecting ? 'Detecting...' : 'Detect Attention Items'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Suggestions ({visibleSuggestions.length})
            </h4>
            <Button
              onClick={handleDetect}
              disabled={isDetecting}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              Refresh
            </Button>
          </div>

          {visibleSuggestions.map((suggestion, index) => {
            const config = severityConfig[suggestion.severity] || severityConfig.info;
            const Icon = config.icon;
            
            return (
              <Card key={index} className={`border ${config.color} p-3`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor} mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h5 className="text-[13px] font-semibold">{suggestion.title}</h5>
                      <Badge className={config.badge}>
                        {suggestion.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Score: {suggestion.score}
                      </Badge>
                    </div>
                    {suggestion.body && (
                      <p className="text-[12px] leading-relaxed mb-2">
                        {suggestion.body}
                      </p>
                    )}
                    <div className="text-[10px] text-gray-500">
                      Audience: {suggestion.audience}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleApprove(suggestion, index)}
                      className="h-7 px-2 text-[12px] text-green-600 hover:text-green-700 hover:bg-green-50"
                      disabled={approveMutation.isPending}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDismiss(index)}
                      className="h-7 w-7"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}