import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Plus, ChevronDown, ChevronUp, Eye } from "lucide-react";
import CreateAttentionItemModal from "./CreateAttentionItemModal";
import EvidenceModal from "./EvidenceModal";
import ResolveAttentionItemModal from "./ResolveAttentionItemModal";

const CATEGORY_COLORS = {
  "Customer Sentiment": "bg-purple-100 text-purple-800 border-purple-200",
  "Payments": "bg-red-100 text-red-800 border-red-200",
  "Access & Site": "bg-amber-100 text-amber-800 border-amber-200",
  "Logistics": "bg-blue-100 text-blue-800 border-blue-200",
  "Risk": "bg-orange-100 text-orange-800 border-orange-200",
  "Operational": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Other": "bg-gray-100 text-gray-800 border-gray-200"
};

const AUDIENCE_LABELS = {
  office: "Office",
  technician: "Technician",
  both: "All"
};

export default function AttentionItemsPanel({ 
  entity_type, 
  entity_id, 
  inherited = [],
  showCreateButton = true 
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evidenceItem, setEvidenceItem] = useState(null);
  const [resolvingItem, setResolvingItem] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const queryClient = useQueryClient();

  // Fetch active items for this entity
  const { data: activeItems = [] } = useQuery({
    queryKey: ['attentionItems', entity_type, entity_id, 'active'],
    queryFn: () => base44.entities.AttentionItem.filter({ 
      entity_type, 
      entity_id, 
      status: 'active' 
    }, '-created_date'),
    refetchInterval: 30000 // Refresh every 30s
  });

  // Fetch resolved items (only when expanded)
  const { data: resolvedItems = [] } = useQuery({
    queryKey: ['attentionItems', entity_type, entity_id, 'resolved'],
    queryFn: () => base44.entities.AttentionItem.filter({ 
      entity_type, 
      entity_id, 
      status: 'resolved' 
    }, '-resolved_at'),
    enabled: showResolved
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }) => 
      base44.entities.AttentionItem.update(id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: base44.auth.me().then(u => u.email),
        resolved_by_name: base44.auth.me().then(u => u.full_name),
        resolution_notes: notes
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems'] });
      setResolvingItem(null);
    }
  });

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'important':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const allActiveItems = [...inherited.filter(i => i.status === 'active'), ...activeItems];

  if (allActiveItems.length === 0 && !showCreateButton) {
    return null;
  }

  return (
    <>
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Attention Items
              {allActiveItems.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {allActiveItems.length}
                </Badge>
              )}
            </CardTitle>
            {showCreateButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {allActiveItems.length === 0 ? (
            <p className="text-sm text-gray-500">No active attention items</p>
          ) : (
            allActiveItems.map((item) => {
              const isInherited = inherited.some(i => i.id === item.id);
              
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${isInherited ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getSeverityIcon(item.severity)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 mb-1">
                          {item.title}
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge className={CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}>
                            {item.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {AUDIENCE_LABELS[item.audience]}
                          </Badge>
                          {isInherited && (
                            <Badge variant="secondary" className="text-xs">
                              Inherited
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                          {item.summary}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {item.created_by === 'ai' ? (
                            <span className="italic">Generated by AI</span>
                          ) : (
                            <span>Added by {item.created_by_name}</span>
                          )}
                          {' • '}
                          {new Date(item.created_date || item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {!isInherited && (
                    <div className="flex gap-2 mt-3">
                      {item.evidence && item.evidence.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEvidenceItem(item)}
                          className="text-xs gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View Evidence
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResolvingItem(item)}
                        className="text-xs"
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {resolvedItems.length > 0 && (
            <div className="pt-3 border-t">
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 w-full"
              >
                {showResolved ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {resolvedItems.length} Resolved Item{resolvedItems.length !== 1 && 's'}
              </button>
              
              {showResolved && (
                <div className="mt-3 space-y-2">
                  {resolvedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-gray-50 border border-gray-200 opacity-60"
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(item.severity)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-gray-700 line-through">
                            {item.title}
                          </h4>
                          <div className="text-xs text-gray-500 mt-1">
                            Resolved by {item.resolved_by_name} on{' '}
                            {new Date(item.resolved_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAttentionItemModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        entity_type={entity_type}
        entity_id={entity_id}
      />

      <EvidenceModal
        item={evidenceItem}
        onClose={() => setEvidenceItem(null)}
      />

      <ResolveAttentionItemModal
        item={resolvingItem}
        onClose={() => setResolvingItem(null)}
        onResolve={(notes) => resolveMutation.mutate({ id: resolvingItem.id, notes })}
        isSubmitting={resolveMutation.isPending}
      />
    </>
  );
}