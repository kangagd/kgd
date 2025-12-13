import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Lock, DollarSign, Shield, Ban, ChevronDown, ChevronUp, Check, Plus, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AttentionItemModal from "./AttentionItemModal";
import ResolveModal from "./ResolveModal";

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

function AttentionItemCard({ item, onResolve, onEdit, canEdit }) {
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
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-[#111827] text-[15px]">{item.title}</h4>
              {item._isInherited && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  From {item._inheritedFrom === 'project' ? 'Project' : item._inheritedFrom === 'customer' ? 'Customer' : 'Job'}
                </Badge>
              )}
            </div>
            
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

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onResolve(item)}
                  variant="outline"
                  size="sm"
                  className="text-[13px] h-8"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark Resolved
                </Button>
                {canEdit && item.created_by_type === 'user' && (
                  <Button
                    onClick={() => onEdit(item)}
                    variant="ghost"
                    size="sm"
                    className="text-[13px] h-8"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <span className="text-[11px] text-[#9CA3AF]">
                {item.created_by_type === 'ai' ? 'AI Generated' : `Added by ${item.created_by_name}`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AttentionItemsPanel({ entity_type, entity_id, context_ids = {} }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [resolvingItem, setResolvingItem] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await base44.auth.me());
      } catch (e) {
        // Not authenticated
      }
    };
    loadUser();
  }, []);

  const { data: items = [] } = useQuery({
    queryKey: ['attentionItems', entity_type, entity_id, JSON.stringify(context_ids)],
    queryFn: async () => {
      const allItems = [];
      const seenFingerprints = new Set();
      
      // Determine which entities to query based on entity_type
      const entitiesToQuery = [];
      
      if (entity_type === 'job') {
        // For jobs: show job items, then project items, then customer items
        if (entity_id) {
          entitiesToQuery.push({ type: 'job', id: entity_id });
        }
        if (context_ids.project_id) {
          entitiesToQuery.push({ type: 'project', id: context_ids.project_id });
        }
        if (context_ids.customer_id) {
          entitiesToQuery.push({ type: 'customer', id: context_ids.customer_id });
        }
      } else if (entity_type === 'project') {
        // For projects: show project items, then customer items
        if (entity_id) {
          entitiesToQuery.push({ type: 'project', id: entity_id });
        }
        if (context_ids.customer_id) {
          entitiesToQuery.push({ type: 'customer', id: context_ids.customer_id });
        }
      } else if (entity_type === 'customer') {
        // For customers: show only customer items
        if (entity_id) {
          entitiesToQuery.push({ type: 'customer', id: entity_id });
        }
      }
      
      // Fetch items in priority order (most specific first)
      for (const entity of entitiesToQuery) {
        try {
          const entityItems = await base44.entities.AttentionItem.filter({
            entity_type: entity.type,
            entity_id: entity.id,
            status: 'open'
          }, '-created_at');
          
          // Add items only if fingerprint not seen (dedupe)
          for (const item of entityItems) {
            if (item.fingerprint && seenFingerprints.has(item.fingerprint)) {
              continue; // Skip duplicate
            }
            
            // Mark as inherited if not from current entity
            const isInherited = item.entity_type !== entity_type || item.entity_id !== entity_id;
            allItems.push({
              ...item,
              _isInherited: isInherited,
              _inheritedFrom: isInherited ? item.entity_type : null
            });
            
            if (item.fingerprint) {
              seenFingerprints.add(item.fingerprint);
            }
          }
        } catch (e) {
          console.error(`Error fetching items for ${entity.type}:`, e);
        }
      }
      
      // Limit to 3 items
      return allItems.slice(0, 3);
    },
    enabled: !!entity_type && !!entity_id
  });

  const canManageItems = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'user';

  const createItemMutation = useMutation({
    mutationFn: (data) => base44.entities.AttentionItem.create({
      ...data,
      created_by_type: 'user',
      created_by_name: user?.full_name || user?.email || 'User'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems', entity_type, entity_id] });
      setShowModal(false);
      setEditingItem(null);
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AttentionItem.update(id, {
      ...data,
      updated_by_name: user?.full_name || user?.email || 'User',
      updated_at: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems', entity_type, entity_id] });
      setShowModal(false);
      setEditingItem(null);
    }
  });

  const resolveItemMutation = useMutation({
    mutationFn: ({ itemId, note }) => base44.entities.AttentionItem.update(itemId, { 
      status: 'resolved',
      resolved_by_name: user?.full_name || user?.email || 'User',
      resolved_at: new Date().toISOString(),
      resolution_note: note || undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems', entity_type, entity_id] });
      setResolvingItem(null);
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.AttentionItem.update(itemId, { 
      status: 'resolved',
      resolved_by_name: user?.full_name || user?.email || 'User',
      resolved_at: new Date().toISOString(),
      resolution_note: 'Deleted by user'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems', entity_type, entity_id] });
      setShowModal(false);
      setEditingItem(null);
    }
  });

  const handleSave = (data) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleResolve = (item) => {
    setResolvingItem(item);
  };

  const handleConfirmResolve = (itemId, note) => {
    resolveItemMutation.mutate({ itemId, note });
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  // If no items and no permission to create, show nothing
  if ((!items || items.length === 0) && !canManageItems) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-[#D97706]" />
        <h3 className="text-[16px] font-semibold text-[#111827]">Attention Items</h3>
        {items.length > 0 && (
          <Badge variant="outline">{items.length}</Badge>
        )}
        {canManageItems && (
          <Button
            onClick={() => {
              setEditingItem(null);
              setShowModal(true);
            }}
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-[13px]"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>
      
      {items.length === 0 ? (
        <p className="text-[13px] text-[#6B7280] italic">No attention items</p>
      ) : (
        items.map((item) => (
          <AttentionItemCard
            key={item.id}
            item={item}
            onResolve={handleResolve}
            onEdit={handleEdit}
            canEdit={canManageItems}
          />
        ))
      )}

      <AttentionItemModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        item={editingItem}
        entity_type={entity_type}
        entity_id={entity_id}
        onSave={handleSave}
        onDelete={deleteItemMutation.mutate}
      />

      {resolvingItem && (
        <ResolveModal
          open={!!resolvingItem}
          onClose={() => setResolvingItem(null)}
          item={resolvingItem}
          onConfirm={handleConfirmResolve}
        />
      )}
    </div>
  );
}