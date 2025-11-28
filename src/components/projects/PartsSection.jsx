import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, X, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PartDetailModal from "./PartDetailModal";
import { Link as LinkIcon, MapPin, Truck } from "lucide-react";

const statusColors = {
  "Pending": "bg-slate-100 text-slate-800 border-slate-200",
  "Ordered": "bg-blue-100 text-blue-800 border-blue-200",
  "Back-ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Returned": "bg-orange-100 text-orange-800 border-orange-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

const locationColors = {
  "On Order": "bg-slate-50 text-slate-600",
  "At Supplier": "bg-indigo-50 text-indigo-600",
  "At Delivery Bay": "bg-blue-50 text-blue-600",
  "In Warehouse Storage": "bg-purple-50 text-purple-600",
  "With Technician": "bg-amber-50 text-amber-600",
  "At Client Site": "bg-green-50 text-green-600"
};

export default function PartsSection({ projectId, autoExpand = false }) {
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const queryClient = useQueryClient();

  const { data: parts = [] } = useQuery({
    queryKey: ['parts', projectId],
    queryFn: () => base44.entities.Part.filter({ project_id: projectId }, '-order_date')
  });

  const createPartMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('managePart', { action: 'create', data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowModal(false);
      setEditingPart(null);
    }
  });

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke('managePart', { action: 'update', id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowModal(false);
      setEditingPart(null);
    }
  });

  const deletePartMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('managePart', { action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowModal(false); 
    }
  });

  useEffect(() => {
    if (autoExpand && parts.length === 0) {
      handleAddPart();
    }
  }, [autoExpand, parts.length, projectId]);

  const handleAddPart = () => {
    setEditingPart(null); // null indicates new
    setShowModal(true);
  };

  const handleEditPart = (part) => {
    setEditingPart(part);
    setShowModal(true);
  };

  const handleSave = (data) => {
    if (editingPart?.id) {
      updatePartMutation.mutate({ id: editingPart.id, data });
    } else {
      createPartMutation.mutate({ ...data, project_id: projectId });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-[14px] font-medium text-[#111827]">
          Parts
        </label>
        <button
          onClick={handleAddPart}
          className="w-8 h-8 bg-[#FAE008] hover:bg-[#E5CF07] rounded-lg flex items-center justify-center transition-colors"
        >
          <Plus className="w-4 h-4 text-[#111827]" />
        </button>
      </div>

      <div className="space-y-2">
        {parts.length === 0 ? (
          <Card className="border border-[#E5E7EB] shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-[14px] text-[#6B7280] mb-3">No parts ordered yet</p>
              <Button onClick={handleAddPart} className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                Order Part
              </Button>
            </CardContent>
          </Card>
        ) : (
          parts.map((part) => (
            <Card 
              key={part.id} 
              className="border border-[#E5E7EB] hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer group"
              onClick={() => handleEditPart(part)}
            >
              <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Left: Category & Supplier */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[#111827] text-[15px]">
                      {part.category || "Part"}
                    </span>
                    {part.supplier_name && (
                      <>
                        <span className="text-[#9CA3AF]">•</span>
                        <span className="text-[#4B5563] text-[14px] truncate">{part.supplier_name}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                    {part.source_type && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-[11px] font-medium border border-slate-200">
                        {part.source_type === "In Stock (KGD)" ? "In Stock" : part.source_type.split(' – ')[0]}
                      </span>
                    )}
                    {(part.eta || part.estimated_arrival_date) && (
                      <span className="flex items-center gap-1">
                        <span className="text-[#9CA3AF]">ETA:</span>
                        <span className="font-medium text-[#111827]">
                          {new Date(part.eta || part.estimated_arrival_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Status & Location */}
                <div className="flex items-center gap-2 sm:justify-end flex-wrap">
                  {(part.linked_logistics_jobs || []).length > 0 && (
                    <div className="flex items-center gap-1 text-[12px] text-[#6B7280] bg-slate-50 px-2 py-1 rounded-full border border-slate-200" title={`${part.linked_logistics_jobs.length} logistics jobs linked`}>
                      <LinkIcon className="w-3 h-3" />
                      <span className="font-medium">{part.linked_logistics_jobs.length}</span>
                    </div>
                  )}
                  
                  {part.location && (
                    <Badge className={`${locationColors[part.location] || 'bg-slate-50 text-slate-600'} border-0 font-normal`}>
                      <MapPin className="w-3 h-3 mr-1 opacity-70" />
                      {part.location}
                    </Badge>
                  )}

                  <Badge className={`${statusColors[part.status] || statusColors['Pending']} font-medium border px-2.5 py-1`}>
                    {part.status || 'Pending'}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent opening modal
                      if (confirm('Are you sure you want to delete this part?')) {
                        deletePartMutation.mutate(part.id);
                      }
                    }}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 -mr-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showModal && (
        <PartDetailModal
          open={showModal}
          part={editingPart}
          onClose={() => {
            setShowModal(false);
            setEditingPart(null);
          }}
          onSave={handleSave}
          isSubmitting={createPartMutation.isPending || updatePartMutation.isPending}
        />
      )}
    </div>
  );
}