import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Lock, DollarSign, Shield, Ban, ChevronDown, ChevronRight, CheckCircle, Plus, Pencil, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AttentionItemModal from "./AttentionItemModal";
import ResolveModal from "./ResolveModal";

const getCategoryIcon = (category) => {
  switch (category) {
    case "Access & Site": return Lock;
    case "Payments": return DollarSign;
    case "Customer Risk": return AlertTriangle;
    case "Customer Concern": return AlertCircle;
    case "Safety": return Shield;
    case "Hard Blocker": return Ban;
    default: return AlertCircle;
  }
};

const getSeverityBorderColor = (severity) => {
  return severity === 'critical' ? 'border-l-orange-400' : 'border-l-yellow-400';
};

const getSeverityBgColor = (severity) => {
  return severity === 'critical' ? 'bg-orange-50/30' : 'bg-yellow-50/30';
};

function AttentionItemCard({ item, onResolve, onEdit, canEdit }) {
  const [isExpanded, setIsExpanded] = useState(item.severity === 'critical');
  const [showEvidence, setShowEvidence] = useState(false);
  const Icon = getCategoryIcon(item.category);

  return (
    <div className={`border-l-2 ${getSeverityBorderColor(item.severity)} ${getSeverityBgColor(item.severity)} rounded-md p-3 transition-all hover:shadow-sm group`}>
      {/* Header Row */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <h4 className="font-semibold text-slate-900 text-sm truncate">{item.title}</h4>
          <span className="text-slate-400">·</span>
          <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs border-0 flex-shrink-0">
            {item.category}
          </Badge>
          <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs border-0 flex-shrink-0">
            {item.audience === 'both' ? 'Tech & Office' : item.audience === 'tech' ? 'Tech' : 'Office'}
          </Badge>
          {item._isInherited && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
              From {item._inheritedFrom === 'project' ? 'Project' : item._inheritedFrom === 'customer' ? 'Customer' : 'Job'}
            </Badge>
          )}
        </button>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onResolve(item)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  <CheckCircle className="w-4 h-4 text-slate-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Mark Resolved</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {canEdit && item.created_by_type === 'user' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onEdit(item)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {item.summary_bullets && item.summary_bullets.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 ml-6">
              {item.summary_bullets.slice(0, 2).map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
          )}

          {item.evidence_excerpt && (
            <div className="ml-6">
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                {showEvidence ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Evidence
              </button>
              {showEvidence && (
                <div className="mt-1 bg-white/50 border border-slate-200 rounded p-2">
                  <p className="text-xs text-slate-600 italic">"{item.evidence_excerpt}"</p>
                  {item.evidence_type && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Source: {item.evidence_type.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Meta */}
          <div className="text-xs text-slate-400 ml-6">
            {item.created_by_type === 'ai' ? 'AI' : item.created_by_name} · {new Date(item.created_at || item.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
    </div>
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
      // Fetch items from all relevant levels
      const allItems = [];
      
      // Helper to assign entity level priority
      const getEntityPriority = (eType) => {
        if (eType === 'job') return 3;
        if (eType === 'project') return 2;
        if (eType === 'customer') return 1;
        return 0;
      };
      
      const getSeverityPriority = (severity) => {
        if (severity === 'critical') return 3;
        if (severity === 'high') return 2;
        if (severity === 'medium') return 1;
        return 0;
      };
      
      // Fetch based on entity_type
      if (entity_type === 'customer' && entity_id) {
        const items = await base44.entities.AttentionItem.filter({
          entity_type: 'customer',
          entity_id: entity_id,
          status: 'open'
        }, '-created_date');
        allItems.push(...(items || []));
      } else if (entity_type === 'project') {
        // Fetch project items
        if (entity_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'project',
            entity_id: entity_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
        // Fetch customer items
        if (context_ids.customer_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'customer',
            entity_id: context_ids.customer_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
      } else if (entity_type === 'job') {
        // Fetch job items
        if (entity_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'job',
            entity_id: entity_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
        // Fetch project items
        if (context_ids.project_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'project',
            entity_id: context_ids.project_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
        // Fetch customer items
        if (context_ids.customer_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'customer',
            entity_id: context_ids.customer_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
      }
      
      // De-duplicate by canonical_key with winner selection
      const keyMap = new Map();
      
      for (const item of allItems) {
        const key = item.canonical_key || item.dedupe_key || item.id;
        
        if (!keyMap.has(key)) {
          keyMap.set(key, item);
        } else {
          const existing = keyMap.get(key);
          
          // Winner selection logic
          const itemPriority = getEntityPriority(item.entity_type);
          const existingPriority = getEntityPriority(existing.entity_type);
          
          // Prefer most specific entity (job > project > customer)
          if (itemPriority > existingPriority) {
            keyMap.set(key, item);
          } else if (itemPriority === existingPriority) {
            // Same entity level: prefer higher severity
            const itemSeverity = getSeverityPriority(item.severity);
            const existingSeverity = getSeverityPriority(existing.severity);
            
            if (itemSeverity > existingSeverity) {
              keyMap.set(key, item);
            } else if (itemSeverity === existingSeverity) {
              // Tie: prefer most recent
              const itemDate = new Date(item.created_date || item.created_at || 0);
              const existingDate = new Date(existing.created_date || existing.created_at || 0);
              
              if (itemDate > existingDate) {
                keyMap.set(key, item);
              }
            }
          }
        }
      }
      
      // Convert to array and mark inherited items
      const dedupedItems = Array.from(keyMap.values()).map(item => {
        const isInherited = item.entity_type !== entity_type || item.entity_id !== entity_id;
        return {
          ...item,
          _isInherited: isInherited,
          _inheritedFrom: isInherited ? item.entity_type : null
        };
      });
      
      // Sort by severity (critical first), then created_date
      dedupedItems.sort((a, b) => {
        const severityA = getSeverityPriority(a.severity);
        const severityB = getSeverityPriority(b.severity);
        if (severityA !== severityB) return severityB - severityA;
        
        const dateA = new Date(a.created_date || a.created_at || 0);
        const dateB = new Date(b.created_date || b.created_at || 0);
        return dateB - dateA;
      });
      
      // Limit to 3 items
      return dedupedItems.slice(0, 3);
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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Attention Items</h3>
        {items.length > 0 && (
          <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs border-0">{items.length}</Badge>
        )}
        {canManageItems && (
          <button
            onClick={() => {
              setEditingItem(null);
              setShowModal(true);
            }}
            className="ml-auto p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>
      
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic ml-6">No attention items</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <AttentionItemCard
              key={item.id}
              item={item}
              onResolve={handleResolve}
              onEdit={handleEdit}
              canEdit={canManageItems}
            />
          ))}
        </div>
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