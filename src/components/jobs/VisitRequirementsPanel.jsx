import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Wrench, FileText, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddCustomItemModal from "./AddCustomItemModal";

/**
 * Dual-mode Requirements UI for Jobs/Visits
 * 
 * COMPLETED CONTEXT (no active visit):
 * - Shows "Product Requirements" (read-only, from Project)
 * 
 * ACTIVE VISIT CONTEXT:
 * - Shows "This Visit Covers" (editable, visit-scoped)
 * - "From Project" button populates visit_covers_items from project requirements
 */
export default function VisitRequirementsPanel({ 
  job, 
  activeVisit, 
  project, 
  projectParts = [], 
  projectTrades = [], 
  isLoading 
}) {
  const queryClient = useQueryClient();
  const [showConfirmFromProject, setShowConfirmFromProject] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customItemType, setCustomItemType] = useState(null);

  const hasActiveVisit = !!activeVisit;
  const visitCovers = activeVisit?.visit_covers_items || [];
  const hasVisitItems = visitCovers.length > 0;

  // Calculate project requirements
  const hasProjectParts = projectParts.length > 0;
  const hasProjectTrades = projectTrades.length > 0;
  const hasProjectRequirements = !!project?.special_requirements;
  const hasAnyProjectContent = hasProjectParts || hasProjectTrades || hasProjectRequirements;

  const updateVisitMutation = useMutation({
    mutationFn: async (visitData) => {
      const response = await base44.functions.invoke('manageVisit', {
        action: 'update',
        id: activeVisit.id,
        data: visitData
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeVisits', job.id] });
      toast.success('Visit updated');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed to update visit');
    }
  });

  const handlePopulateFromProject = () => {
    if (!project || !activeVisit) {
      toast.error('No project or active visit found');
      return;
    }

    // Map project parts to visit_covers_items format
    const partsItems = projectParts.map(p => ({
      key: `project:part:${p.id}`,
      label: p.item_name || p.category || 'Part',
      type: 'part',
      source: 'project',
      ref_id: p.id,
      status: p.status || 'required',
      qty: p.quantity_required || 1
    }));

    // Map project trades to visit_covers_items format
    const tradesItems = projectTrades.map(t => ({
      key: `project:trade:${t.id}`,
      label: t.trade_name || t.trade_type || 'Trade',
      type: 'trade',
      source: 'project',
      ref_id: t.id,
      status: t.is_booked ? 'booked' : 'required'
    }));

    // Map project requirements (special_requirements text) to items
    const requirementsItems = project.special_requirements ? [{
      key: `project:requirement:special`,
      label: 'Special Requirements (see project)',
      type: 'requirement',
      source: 'project',
      ref_id: null,
      status: 'required'
    }] : [];

    const allItems = [...partsItems, ...tradesItems, ...requirementsItems];

    if (allItems.length === 0) {
      toast.error('No project requirements to populate');
      return;
    }

    updateVisitMutation.mutate({
      visit_covers_items: allItems
    });

    setShowConfirmFromProject(false);
  };

  const handleRemoveItem = (key) => {
    const updatedItems = visitCovers.filter(item => item.key !== key);
    updateVisitMutation.mutate({
      visit_covers_items: updatedItems
    });
  };

  const handleAddCustomItem = (item) => {
    const newItem = {
      key: `job:${item.type}:${Date.now()}`,
      label: item.label,
      type: item.type,
      source: 'job',
      ref_id: null,
      status: 'required',
      ...(item.qty && { qty: item.qty })
    };

    updateVisitMutation.mutate({
      visit_covers_items: [...visitCovers, newItem]
    });

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

  // COMPLETED CONTEXT: Show Product Requirements (read-only)
  if (!hasActiveVisit) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-[#F9FAFB] px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <CardTitle className="text-[14px] font-semibold text-[#6B7280] leading-[1.2]">
              Product Requirements
            </CardTitle>
            <span className="text-[11px] text-[#9CA3AF] italic">Inherited from Project</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
              <span className="text-[13px] text-[#6B7280]">Loading project requirements...</span>
            </div>
          ) : !hasAnyProjectContent ? (
            <p className="text-[13px] text-[#9CA3AF] py-2">No project requirements found.</p>
          ) : (
            <div className="space-y-4">
              {/* Parts Required */}
              {hasProjectParts && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-[#6B7280]" />
                    <h4 className="text-[13px] font-semibold text-[#111827]">Parts ({projectParts.length})</h4>
                  </div>
                  <div className="space-y-1.5">
                    {projectParts.map((part) => (
                      <div key={part.id} className="rounded-lg border border-[#E5E7EB] bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-medium text-[#111827] truncate block">
                              {part.item_name || part.category || 'Part'}
                            </span>
                            {part.quantity_required && (
                              <span className="text-[11px] text-[#6B7280]">Qty: {part.quantity_required}</span>
                            )}
                          </div>
                          {part.status && (
                            <Badge className="text-[10px] bg-slate-100 text-slate-700">
                              {part.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Third-party Trades */}
              {hasProjectTrades && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-[#6B7280]" />
                    <h4 className="text-[13px] font-semibold text-[#111827]">Third-party Trades ({projectTrades.length})</h4>
                  </div>
                  <div className="space-y-1.5">
                    {projectTrades.map((trade) => (
                      <div key={trade.id} className="rounded-lg border border-[#E5E7EB] bg-white p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#111827] truncate">
                            {trade.trade_name || trade.trade_type || 'Trade'}
                          </span>
                          {trade.is_booked ? (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">Booked</Badge>
                          ) : trade.is_required ? (
                            <Badge className="bg-amber-100 text-amber-700 text-[10px]">Required</Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Requirements / Notes */}
              {hasProjectRequirements && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <h4 className="text-[13px] font-semibold text-[#111827]">Special Requirements</h4>
                  </div>
                  <div 
                    className="text-[13px] text-[#111827] prose prose-sm max-w-none bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]"
                    dangerouslySetInnerHTML={{ __html: project.special_requirements }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ACTIVE VISIT CONTEXT: Show This Visit Covers (editable)
  return (
    <>
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
              This Visit Covers
            </CardTitle>
            <div className="flex items-center gap-2">
              {job.project_id && hasAnyProjectContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmFromProject(true)}
                  disabled={updateVisitMutation.isPending}
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
                disabled={updateVisitMutation.isPending}
                className="h-8 text-xs border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Custom
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {!hasVisitItems ? (
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
              {/* Group by type */}
              {['part', 'trade', 'requirement'].map(itemType => {
                const items = visitCovers.filter(i => i.type === itemType);
                if (items.length === 0) return null;

                const typeConfig = {
                  part: { icon: Package, label: 'Parts' },
                  trade: { icon: Wrench, label: 'Trades' },
                  requirement: { icon: FileText, label: 'Requirements' }
                };
                const config = typeConfig[itemType];

                return (
                  <div key={itemType}>
                    <div className="flex items-center gap-2 mb-2">
                      <config.icon className="w-4 h-4 text-[#6B7280]" />
                      <h4 className="text-[13px] font-semibold text-[#111827]">{config.label} ({items.length})</h4>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2 hover:bg-[#F9FAFB] transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#111827] truncate">
                                {item.label}
                              </span>
                              {item.source === 'job' && (
                                <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0">Job-only</Badge>
                              )}
                            </div>
                            {item.qty && (
                              <span className="text-[11px] text-[#6B7280]">Qty: {item.qty}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {item.status && item.status !== 'required' && getStatusBadge(item.status)}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.key)}
                              disabled={updateVisitMutation.isPending}
                              className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm From Project Dialog */}
      <AlertDialog open={showConfirmFromProject} onOpenChange={setShowConfirmFromProject}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              Populate This Visit Covers from Project Requirements?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-slate-600 leading-[1.4] space-y-2">
              <p>This will add all project requirements to this visit's scope.</p>
              <p className="text-green-700 font-medium">✓ Project requirements will NOT be modified</p>
              <p className="text-blue-700 font-medium">• Only this visit will be updated</p>
              <p className="text-amber-700 font-medium">• Includes: {projectParts.length} parts, {projectTrades.length} trades{hasProjectRequirements ? ', special requirements' : ''}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePopulateFromProject}
              disabled={updateVisitMutation.isPending}
              className="rounded-xl font-semibold bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              {updateVisitMutation.isPending ? 'Populating...' : 'Populate from Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Custom Item Modal */}
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