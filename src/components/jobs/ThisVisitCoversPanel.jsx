import React, { useState } from "react";
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

  const visitScope = job.visit_scope || { parts: [], trades: [], requirements: [] };
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      toast.success('Visit scope updated');
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed to update visit scope');
    }
  });

  const handleRemoveItem = (key) => {
    updateScopeMutation.mutate({
      remove_keys: [key]
    });
  };

  const handleAddFromProject = (items) => {
    updateScopeMutation.mutate({
      add: items
    });
    setShowAddFromProject(false);
  };

  const handleAddCustomItem = (item) => {
    updateScopeMutation.mutate({
      add: item
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