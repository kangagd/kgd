import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Lock, DollarSign, Shield, Ban, ChevronDown, ChevronRight, CheckCircle, Plus, Pencil, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AttentionItemModal from "./AttentionItemModal";
import ResolveModal from "./ResolveModal";
import { computeAttentionItems } from "../projects/computeAttentionItems";

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
  if (severity === 'critical' || severity === 'HIGH') return 'border-l-red-500';
  if (severity === 'high' || severity === 'MEDIUM') return 'border-l-amber-500';
  return 'border-l-yellow-400';
};

const getSeverityBgColor = (severity) => {
  if (severity === 'critical' || severity === 'HIGH') return 'bg-red-50/40';
  if (severity === 'high' || severity === 'MEDIUM') return 'bg-amber-50/40';
  return 'bg-yellow-50/30';
};

function AttentionItemCard({ item, onResolve, onEdit, onNavigate, canEdit, isDerived }) {
  const [isExpanded, setIsExpanded] = useState(item.severity === 'critical' || item.priority === 'HIGH');
  const [showEvidence, setShowEvidence] = useState(false);
  const Icon = getCategoryIcon(item.category);

  return (
    <div 
      className={`border-l-2 ${getSeverityBorderColor(item.severity || item.priority)} ${getSeverityBgColor(item.severity || item.priority)} rounded-md p-3 transition-all hover:shadow-sm group`}
    >
      {/* Header Row */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <button
          onClick={() => {
            if (isDerived && onNavigate) {
              onNavigate(item.deepLinkTab);
            } else {
              setIsExpanded(!isExpanded);
            }
          }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <h4 className="font-semibold text-slate-900 text-sm truncate">
            {item.title || item.message}
          </h4>
          <span className="text-slate-400">·</span>
          <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs border-0 flex-shrink-0">
            {item.category}
          </Badge>
          {item.audience && (
            <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs border-0 flex-shrink-0">
              {item.audience === 'both' ? 'Tech & Office' : item.audience === 'tech' ? 'Tech' : 'Office'}
            </Badge>
          )}
          {item._isInherited && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
              From {item._inheritedFrom === 'project' ? 'Project' : item._inheritedFrom === 'customer' ? 'Customer' : 'Job'}
            </Badge>
          )}
          {isDerived && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 bg-blue-50 text-blue-700">
              AI
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
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {canEdit && !isDerived && item.created_by_type === 'user' && (
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
      {isExpanded && !isDerived && (
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

export default function UnifiedAttentionPanel({ 
  entity_type, 
  entity_id, 
  context_ids = {},
  // Derived items data
  project,
  quotes = [],
  invoices = [],
  jobs = [],
  parts = [],
  purchaseOrders = [],
  emails = [],
  manualLogs = [],
  tradeRequirements = [],
  onNavigateToTab
}) {
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

  // Fetch manual attention items
  const { data: manualItems = [] } = useQuery({
    queryKey: ['attentionItems', entity_type, entity_id, JSON.stringify(context_ids)],
    queryFn: async () => {
      const allItems = [];
      
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
      
      if (entity_type === 'customer' && entity_id) {
        const items = await base44.entities.AttentionItem.filter({
          entity_type: 'customer',
          entity_id: entity_id,
          status: 'open'
        }, '-created_date');
        allItems.push(...(items || []));
      } else if (entity_type === 'project') {
        if (entity_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'project',
            entity_id: entity_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
        if (context_ids.customer_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'customer',
            entity_id: context_ids.customer_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
      } else if (entity_type === 'job') {
        if (entity_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'job',
            entity_id: entity_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
        if (context_ids.project_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'project',
            entity_id: context_ids.project_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
        if (context_ids.customer_id) {
          const items = await base44.entities.AttentionItem.filter({
            entity_type: 'customer',
            entity_id: context_ids.customer_id,
            status: 'open'
          }, '-created_date');
          allItems.push(...(items || []));
        }
      }
      
      const keyMap = new Map();
      
      for (const item of allItems) {
        const key = item.canonical_key || item.dedupe_key || item.id;
        
        if (!keyMap.has(key)) {
          keyMap.set(key, item);
        } else {
          const existing = keyMap.get(key);
          const itemPriority = getEntityPriority(item.entity_type);
          const existingPriority = getEntityPriority(existing.entity_type);
          
          if (itemPriority > existingPriority) {
            keyMap.set(key, item);
          } else if (itemPriority === existingPriority) {
            const itemSeverity = getSeverityPriority(item.severity);
            const existingSeverity = getSeverityPriority(existing.severity);
            
            if (itemSeverity > existingSeverity) {
              keyMap.set(key, item);
            } else if (itemSeverity === existingSeverity) {
              const itemDate = new Date(item.created_date || item.created_at || 0);
              const existingDate = new Date(existing.created_date || existing.created_at || 0);
              
              if (itemDate > existingDate) {
                keyMap.set(key, item);
              }
            }
          }
        }
      }
      
      const dedupedItems = Array.from(keyMap.values()).map(item => {
        const isInherited = item.entity_type !== entity_type || item.entity_id !== entity_id;
        return {
          ...item,
          _isInherited: isInherited,
          _inheritedFrom: isInherited ? item.entity_type : null
        };
      });
      
      const getSeverityPriorityForSort = (severity) => {
        if (severity === 'critical') return 3;
        if (severity === 'high') return 2;
        if (severity === 'medium') return 1;
        return 0;
      };
      
      dedupedItems.sort((a, b) => {
        const severityA = getSeverityPriorityForSort(a.severity);
        const severityB = getSeverityPriorityForSort(b.severity);
        if (severityA !== severityB) return severityB - severityA;
        
        const dateA = new Date(a.created_date || a.created_at || 0);
        const dateB = new Date(b.created_date || b.created_at || 0);
        return dateB - dateA;
      });
      
      return dedupedItems;
    },
    enabled: !!entity_type && !!entity_id
  });

  // Get AI-derived items
  const derivedItems = React.useMemo(() => {
    if (!project) return [];
    
    return computeAttentionItems({
      project,
      quotes,
      invoices,
      jobs,
      parts,
      purchaseOrders,
      emails,
      manualLogs,
      tradeRequirements
    });
  }, [project, quotes, invoices, jobs, parts, purchaseOrders, emails, manualLogs, tradeRequirements]);

  // Combine and sort all items
  const allItems = React.useMemo(() => {
    const manual = manualItems.map(item => ({ ...item, isDerived: false }));
    const derived = derivedItems.map(item => ({ ...item, isDerived: true }));
    
    const combined = [...manual, ...derived];
    
    // Sort by priority/severity
    combined.sort((a, b) => {
      const getPriority = (item) => {
        const sev = item.severity || item.priority;
        if (sev === 'critical' || sev === 'HIGH') return 3;
        if (sev === 'high' || sev === 'MEDIUM') return 2;
        return 1;
      };
      
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      
      if (priorityA !== priorityB) return priorityB - priorityA;
      
      const dateA = new Date(a.created_date || a.created_at || 0);
      const dateB = new Date(b.created_date || b.created_at || 0);
      return dateB - dateA;
    });
    
    return combined;
  }, [manualItems, derivedItems]);

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
    mutationFn: ({ itemId, note, isDerived }) => {
      if (isDerived) {
        // For derived items, create a dismissed record
        return base44.entities.AttentionItem.create({
          entity_type,
          entity_id,
          canonical_key: itemId,
          title: 'Dismissed AI item',
          category: 'Other',
          severity: 'low',
          status: 'resolved',
          created_by_type: 'user',
          created_by_name: user?.full_name || user?.email || 'User',
          resolved_by_name: user?.full_name || user?.email || 'User',
          resolved_at: new Date().toISOString(),
          resolution_note: note || 'Dismissed by user'
        });
      } else {
        // For manual items, update existing record
        return base44.entities.AttentionItem.update(itemId, { 
          status: 'resolved',
          resolved_by_name: user?.full_name || user?.email || 'User',
          resolved_at: new Date().toISOString(),
          resolution_note: note || undefined
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attentionItems', entity_type, entity_id] });
      setResolvingItem(null);
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
    resolveItemMutation.mutate({ itemId, note, isDerived: resolvingItem.isDerived });
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  // If no items and no permission to create, show nothing
  if (allItems.length === 0 && !canManageItems) {
    return null;
  }

  const highCount = allItems.filter(i => 
    i.severity === 'critical' || i.severity === 'high' || i.priority === 'HIGH'
  ).length;
  
  const mediumCount = allItems.filter(i => 
    i.severity === 'medium' || i.priority === 'MEDIUM'
  ).length;

  return (
    <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 border border-amber-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <CardTitle className="text-[16px] font-semibold text-amber-900">
            Attention Required ({allItems.length})
          </CardTitle>
          {allItems.length > 0 && (
            <span className="text-[12px] text-amber-700 font-medium ml-auto">
              {highCount} high • {mediumCount} medium
            </span>
          )}
          {canManageItems && (
            <button
              onClick={() => {
                setEditingItem(null);
                setShowModal(true);
              }}
              className="p-1 hover:bg-amber-100 rounded transition-colors"
            >
              <Plus className="w-4 h-4 text-amber-700" />
            </button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {allItems.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No attention items</p>
        ) : (
          allItems.map((item, idx) => (
            <AttentionItemCard
              key={item.id || `derived-${idx}`}
              item={item}
              onResolve={handleResolve}
              onEdit={handleEdit}
              onNavigate={onNavigateToTab}
              canEdit={canManageItems}
              isDerived={item.isDerived}
            />
          ))
        )}
      </CardContent>

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
        onDelete={(itemId) => {
          resolveItemMutation.mutate({ itemId, note: 'Deleted by user', isDerived: false });
          setShowModal(false);
          setEditingItem(null);
        }}
      />

      {resolvingItem && (
        <ResolveModal
          open={!!resolvingItem}
          onClose={() => setResolvingItem(null)}
          item={resolvingItem}
          onConfirm={handleConfirmResolve}
        />
      )}
    </Card>
  );
}