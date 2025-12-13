import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AISuggestionsPanel({ entityType, entityId, onSuggestionsApplied }) {
  const [isDetecting, setIsDetecting] = useState(false);
  const queryClient = useQueryClient();

  const detectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('evaluateAttentionItems', {
        entityType,
        entityId,
        eventType: 'manual.trigger'
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        const count = data.created_count || 0;
        const resolvedCount = data.resolved_count || 0;
        
        if (count === 0 && resolvedCount === 0) {
          toast.info('No new attention items detected');
        } else {
          if (count > 0) toast.success(`Created ${count} attention item(s)`);
          if (resolvedCount > 0) toast.success(`Resolved ${resolvedCount} item(s)`);
          if (onSuggestionsApplied) onSuggestionsApplied();
        }
      }
    },
    onError: (error) => {
      toast.error('Failed to detect attention items');
    }
  });



  const handleDetect = () => {
    setIsDetecting(true);
    detectMutation.mutate(undefined, {
      onSettled: () => setIsDetecting(false)
    });
  };

  return (
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
      {isDetecting ? 'Evaluating...' : 'Re-evaluate Attention Items'}
    </Button>
  );
}