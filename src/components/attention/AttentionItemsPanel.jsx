import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Lock, DollarSign, Shield, Ban, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const getCategoryIcon = (category) => {
  switch (category) {
    case "Access & Site": return Lock;
    case "Payments": return DollarSign;
    case "Customer Risk": return AlertTriangle;
    case "Safety": return Shield;
    case "Hard Blocker": return Ban;
    default: return AlertCircle;
  }
};

const getCategoryColor = (category) => {
  switch (category) {
    case "Access & Site": return "bg-purple-100 text-purple-700";
    case "Payments": return "bg-green-100 text-green-700";
    case "Customer Risk": return "bg-orange-100 text-orange-700";
    case "Safety": return "bg-red-100 text-red-700";
    case "Hard Blocker": return "bg-gray-900 text-white";
    default: return "bg-gray-100 text-gray-700";
  }
};

const getAudienceColor = (audience) => {
  switch (audience) {
    case "tech": return "bg-blue-100 text-blue-700";
    case "office": return "bg-indigo-100 text-indigo-700";
    case "both": return "bg-purple-100 text-purple-700";
    default: return "bg-gray-100 text-gray-700";
  }
};

function AttentionItemCard({ item, onResolve }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const Icon = getCategoryIcon(item.category);

  return (
    <Card className={`border-l-4 ${item.severity === 'critical' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${item.severity === 'critical' ? 'bg-red-100' : 'bg-orange-100'}`}>
            <Icon className={`w-5 h-5 ${item.severity === 'critical' ? 'text-red-600' : 'text-orange-600'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[#111827] text-[15px] mb-2">{item.title}</h4>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className={getCategoryColor(item.category)}>
                {item.category}
              </Badge>
              <Badge className={getAudienceColor(item.audience)}>
                {item.audience === 'both' ? 'Tech & Office' : item.audience === 'tech' ? 'Technician' : 'Office'}
              </Badge>
              {item.severity === 'critical' && (
                <Badge className="bg-red-100 text-red-700">
                  Critical
                </Badge>
              )}
            </div>

            {item.summary_bullets && item.summary_bullets.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-[14px] text-[#4B5563] mb-3">
                {item.summary_bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            )}

            {item.evidence_excerpt && (
              <Collapsible open={showEvidence} onOpenChange={setShowEvidence}>
                <CollapsibleTrigger className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-[#111827] transition-colors">
                  {showEvidence ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  View evidence
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
                    <p className="text-[13px] text-[#4B5563] italic">"{item.evidence_excerpt}"</p>
                    {item.evidence_type && (
                      <p className="text-[11px] text-[#6B7280] mt-1">
                        Source: {item.evidence_type.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex items-center gap-2 mt-3">
              <Button
                onClick={() => onResolve(item.id)}
                variant="outline"
                size="sm"
                className="text-[13px] h-8"
              >
                <Check className="w-3 h-3 mr-1" />
                Mark Resolved
              </Button>
              {item.created_by_type === 'ai' && (
                <span className="text-[11px] text-[#9CA3AF]">AI Generated</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AttentionItemsPanel({ entity_type, entity_id }) {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['attentionItems', entity_type, entity_id],
    queryFn: () => base44.entities.AttentionItem.filter({
      entity_type,
      entity_id,
      status: 'open'
    }),
    enabled: !!entity_type && !!entity_id
  });

  const resolveItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.AttentionItem.update(itemId, { status: 'resolved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems', entity_type, entity_id] });
    }
  });

  // Show nothing if no items
  if (!items || items.length === 0) {
    return null;
  }

  // Show max 3 items
  const displayItems = items.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-[#D97706]" />
        <h3 className="text-[16px] font-semibold text-[#111827]">Attention Items</h3>
        <Badge variant="outline" className="ml-auto">{displayItems.length}</Badge>
      </div>
      
      {displayItems.map((item) => (
        <AttentionItemCard
          key={item.id}
          item={item}
          onResolve={resolveItemMutation.mutate}
        />
      ))}
    </div>
  );
}