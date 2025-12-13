import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, AlertCircle, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CreateAttentionItemModal from "./CreateAttentionItemModal";
import AISuggestionsPanel from "./AISuggestionsPanel";

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

export default function AttentionItemsDisplay({ 
  entityType, 
  entityId, 
  projectId = null,
  customerId = null,
  user 
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const effectiveRole = user?.role === 'admin' || user?.role === 'manager' ? 'office' : 
                       user?.is_field_technician ? 'tech' : 'office';

  // Fetch attention items for current entity
  const { data: directItems = [] } = useQuery({
    queryKey: ['attentionItems', entityType, entityId],
    queryFn: async () => {
      const items = await base44.entities.AttentionItem.filter({
        entity_type: entityType,
        entity_id: entityId,
        status: 'active'
      });
      return items || [];
    },
    enabled: !!entityId
  });

  // Fetch project-level items if viewing a job
  const { data: projectItems = [] } = useQuery({
    queryKey: ['attentionItems', 'project', projectId],
    queryFn: async () => {
      const items = await base44.entities.AttentionItem.filter({
        entity_type: 'project',
        entity_id: projectId,
        status: 'active'
      });
      return items || [];
    },
    enabled: entityType === 'job' && !!projectId
  });

  // Fetch customer-level items
  const { data: customerItems = [] } = useQuery({
    queryKey: ['attentionItems', 'customer', customerId],
    queryFn: async () => {
      const items = await base44.entities.AttentionItem.filter({
        entity_type: 'customer',
        entity_id: customerId,
        status: 'active'
      });
      return items || [];
    },
    enabled: !!customerId
  });

  const dismissMutation = useMutation({
    mutationFn: (itemId) => base44.entities.AttentionItem.update(itemId, {
      status: 'dismissed',
      dismissed_by: user?.email,
      dismissed_at: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems'] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (itemId) => base44.entities.AttentionItem.update(itemId, {
      status: 'resolved',
      resolved_by: user?.email,
      resolved_at: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems'] });
    }
  });

  // Combine and filter items by role
  const allItems = [
    ...directItems,
    ...projectItems.map(item => ({ ...item, sourceLabel: 'From Project' })),
    ...customerItems.map(item => ({ ...item, sourceLabel: 'From Customer' }))
  ].filter(item => {
    if (effectiveRole === 'tech') {
      return item.audience === 'tech' || item.audience === 'both';
    }
    if (effectiveRole === 'office') {
      return item.audience === 'office' || item.audience === 'both';
    }
    return true; // admin sees all
  });

  if (allItems.length === 0 && !showCreateModal) {
    return (
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Attention Item
          </Button>
        </div>
        <AISuggestionsPanel
          entityType={entityType}
          entityId={entityId}
          onSuggestionsApplied={() => queryClient.invalidateQueries({ queryKey: ['attentionItems'] })}
        />
        {showCreateModal && (
          <CreateAttentionItemModal
            entityType={entityType}
            entityId={entityId}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Attention Items
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="gap-2 h-8"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      <AISuggestionsPanel
        entityType={entityType}
        entityId={entityId}
        onSuggestionsApplied={() => queryClient.invalidateQueries({ queryKey: ['attentionItems'] })}
      />

      {allItems.map((item) => {
        const config = severityConfig[item.severity] || severityConfig.info;
        const Icon = config.icon;
        
        return (
          <Card key={item.id} className={`border ${config.color} p-4`}>
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor} mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="text-[14px] font-semibold">{item.title}</h4>
                  <Badge className={config.badge}>
                    {item.severity}
                  </Badge>
                  {item.sourceLabel && (
                    <Badge variant="outline" className="text-[11px]">
                      {item.sourceLabel}
                    </Badge>
                  )}
                  {item.source === 'ai' && (
                    <Badge variant="outline" className="text-[11px]">
                      AI Generated
                    </Badge>
                  )}
                </div>
                {item.body && (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                    {item.body}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resolveMutation.mutate(item.id)}
                  className="h-8 px-2 text-[13px]"
                  disabled={resolveMutation.isPending}
                >
                  Resolve
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dismissMutation.mutate(item.id)}
                  className="h-8 w-8"
                  disabled={dismissMutation.isPending}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      {showCreateModal && (
        <CreateAttentionItemModal
          entityType={entityType}
          entityId={entityId}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}