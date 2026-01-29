import React, { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Wrench, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AddFromProjectModal from "./AddFromProjectModal";
import AddCustomItemModal from "./AddCustomItemModal";

export default function ThisVisitCoversPanel({ job, projectParts = [], projectTrades = [], projectRequirements }) {
  const queryClient = useQueryClient();
  const [showAddFromProject, setShowAddFromProject] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customItemType, setCustomItemType] = useState(null); // 'part', 'trade', 'requirement'

  // Step 1: Local draft state decoupled from query data
  const [draft, setDraft] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const lastServerHashRef = useRef("");

  // Initialize draft from job.visit_scope only once or when not dirty
  useEffect(() => {
    const serverData = job.visit_scope || { parts: [], trades: [], requirements: [] };
    const serverHash = JSON.stringify(serverData);
    const changed = serverHash !== lastServerHashRef.current;

    if (changed && !isDirty) {
      setDraft(serverData);
      lastServerHashRef.current = serverHash;
    }
  }, [job.visit_scope, isDirty]);

  const visitScope = draft || job.visit_scope || { parts: [], trades: [], requirements: [] };
  const hasScopeItems = (visitScope.parts?.length > 0) || 
                        (visitScope.trades?.length > 0) || 
                        (visitScope.requirements?.length > 0);

  const updateScopeMutation = useMutation({
    mutationFn: async (patch) => {
      const response = await base44.functions.invoke('updateJobVisitScope', {
        job_id: job.id,
        patch,
        mode: 'safe'
      });
      return response.data;
    },
    onSuccess: (result) => {
      // Patch cache instead of invalidate
      queryClient.setQueryData(['job', job.id], (oldJob) => {
        if (!oldJob) return oldJob;
        return {
          ...oldJob,
          visit_scope: result.visit_scope || oldJob.visit_scope,
        };
      });
      
      // Reset draft state after successful save
      setDraft(result.visit_scope || job.visit_scope);
      setIsDirty(false);
      lastServerHashRef.current = JSON.stringify(result.visit_scope);
      toast.success('Visit scope updated');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed to update visit scope');
    }
  });

  // Step 2: Debounced autosave
  const autosaveTimerRef = useRef(null);
  const debouncedSave = (updatedDraft) => {
    // Cancel pending autosave
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    
    // Schedule new autosave
    autosaveTimerRef.current = setTimeout(() => {
      // Build minimal patch from draft vs server
      const serverData = job.visit_scope || { parts: [], trades: [], requirements: [] };
      const patch = {};

      // Detect removals
      const serverKeys = new Set([
        ...(serverData.parts || []).map(p => p.key),
        ...(serverData.trades || []).map(t => t.key),
        ...(serverData.requirements || []).map(r => r.key),
      ]);
      const draftKeys = new Set([
        ...(updatedDraft.parts || []).map(p => p.key),
        ...(updatedDraft.trades || []).map(t => t.key),
        ...(updatedDraft.requirements || []).map(r => r.key),
      ]);
      const removed = [...serverKeys].filter(k => !draftKeys.has(k));
      if (removed.length > 0) patch.remove_keys = removed;

      // Detect additions
      const allDraftItems = [
        ...(updatedDraft.parts || []),
        ...(updatedDraft.trades || []),
        ...(updatedDraft.requirements || []),
      ];
      const added = allDraftItems.filter(item => !serverKeys.has(item.key));
      if (added.length > 0) patch.add = added;

      // Only mutate if there are actual changes
      if (Object.keys(patch).length > 0) {
        updateScopeMutation.mutate(patch);
      } else {
        setIsDirty(false);
      }
    }, 800); // 800ms debounce
  };

  const handleRemoveItem = (key) => {
    const updated = {
      ...draft,
      parts: draft.parts.filter(p => p.key !== key),
      trades: draft.trades.filter(t => t.key !== key),
      requirements: draft.requirements.filter(r => r.key !== key),
    };
    setDraft(updated);
    setIsDirty(true);
    debouncedSave(updated);
  };

  const handleAddFromProject = (items) => {
    const updated = {
      parts: [...(draft.parts || []), ...items.filter(i => i.type === 'part')],
      trades: [...(draft.trades || []), ...items.filter(i => i.type === 'trade')],
      requirements: [...(draft.requirements || []), ...items.filter(i => i.type === 'requirement')],
    };
    setDraft(updated);
    setIsDirty(true);
    debouncedSave(updated);
    setShowAddFromProject(false);
  };

  const handleAddCustomItem = (item) => {
    const itemType = item.type || 'part';
    const updated = {
      ...draft,
      [itemType === 'part' ? 'parts' : itemType === 'trade' ? 'trades' : 'requirements']: [
        ...(draft[itemType === 'part' ? 'parts' : itemType === 'trade' ? 'trades' : 'requirements'] || []),
        item,
      ],
    };
    setDraft(updated);
    setIsDirty(true);
    debouncedSave(updated);
    setShowAddCustom(false);
    setCustomItemType(null);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      required: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Required' },
      ordered: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ordered' },
      in_storage: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Storage' },
      in_vehicle: { bg: 'bg-green-100', text: 'text-green-700', label: 'In Vehicle' },
      installed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Installed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
      booked: { bg: 'bg-green-100', text: 'text-green-700', label: 'Booked' },
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
      done: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Done' },
      unknown: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Unknown' },
    };
    const config = statusConfig[status] || statusConfig.unknown;
    return (
      <Badge className={`${config.bg} ${config.text} text-[10px] border-0`}>
        {config.label}
      </Badge>
    );
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  return (
    <>
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
              This Visit Covers
            </CardTitle>
            <div className="flex items-center gap-2">
              {job.project_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddFromProject(true)}
                  className="h-8 text-xs border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  From Project
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomItemType('part');
                  setShowAddCustom(true);
                }}
                className="h-8 text-xs border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Custom
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {!hasScopeItems ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-[#E5E7EB] mx-auto mb-2" />
              <p className="text-[13px] text-[#9CA3AF] font-medium">
                Nothing required for this visit yet
              </p>
              <p className="text-[11px] text-[#D1D5DB] mt-1">
                Add items from the project or create custom items
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Parts */}
              {visitScope.parts?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-[#6B7280]" />
                    <h4 className="text-[13px] font-semibold text-[#111827]">Parts ({visitScope.parts.length})</h4>
                  </div>
                  <div className="space-y-1.5">
                    {visitScope.parts.map((part) => (
                      <div key={part.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-[#F9FAFB] transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#111827] truncate">
                              {part.label}
                            </span>
                            {part.source === 'job' && (
                              <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0">Job-only</Badge>
                            )}
                          </div>
                          {part.qty && (
                            <span className="text-[11px] text-[#6B7280]">Qty: {part.qty}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {part.status && part.status !== 'required' && getStatusBadge(part.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(part.key)}
                            disabled={updateScopeMutation.isPending}
                            className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trades */}
              {visitScope.trades?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-[#6B7280]" />
                    <h4 className="text-[13px] font-semibold text-[#111827]">Trades ({visitScope.trades.length})</h4>
                  </div>
                  <div className="space-y-1.5">
                    {visitScope.trades.map((trade) => (
                      <div key={trade.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-[#F9FAFB] transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#111827] truncate">
                              {trade.label}
                            </span>
                            {trade.source === 'job' && (
                              <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0">Job-only</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {trade.status && trade.status !== 'required' && getStatusBadge(trade.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(trade.key)}
                            disabled={updateScopeMutation.isPending}
                            className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {visitScope.requirements?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <h4 className="text-[13px] font-semibold text-[#111827]">Requirements ({visitScope.requirements.length})</h4>
                  </div>
                  <div className="space-y-1.5">
                    {visitScope.requirements.map((req) => (
                      <div key={req.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-[#F9FAFB] transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#111827] truncate">
                              {req.label}
                            </span>
                            {req.source === 'job' && (
                              <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0">Job-only</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {req.status && req.status !== 'required' && getStatusBadge(req.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(req.key)}
                            disabled={updateScopeMutation.isPending}
                            className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddFromProject && (
        <AddFromProjectModal
          open={showAddFromProject}
          onClose={() => setShowAddFromProject(false)}
          onAdd={handleAddFromProject}
          projectParts={projectParts}
          projectTrades={projectTrades}
          projectRequirements={projectRequirements}
          currentScope={visitScope}
        />
      )}

      {showAddCustom && (
        <AddCustomItemModal
          open={showAddCustom}
          onClose={() => {
            setShowAddCustom(false);
            setCustomItemType(null);
          }}
          onAdd={handleAddCustomItem}
          itemType={customItemType}
        />
      )}
    </>
  );
}