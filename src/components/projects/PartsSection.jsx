import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, X, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TextField from "../common/TextField";

const statusColors = {
  "Pending": "bg-slate-100 text-slate-800 border-slate-200",
  "Ordered": "bg-blue-100 text-blue-800 border-blue-200",
  "Back-ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

export default function PartsSection({ projectId, autoExpand = false }) {
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [uploading, setUploading] = useState(false);
  const supplierNameRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: parts = [] } = useQuery({
    queryKey: ['parts', projectId],
    queryFn: () => base44.entities.Part.filter({ project_id: projectId }, '-order_date')
  });

  const createPartMutation = useMutation({
    mutationFn: (data) => base44.entities.Part.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowForm(false);
      setEditingPart(null);
    }
  });

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Part.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
      setShowForm(false);
      setEditingPart(null);
    }
  });

  const deletePartMutation = useMutation({
    mutationFn: (id) => base44.entities.Part.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', projectId] });
    }
  });

  useEffect(() => {
    if (autoExpand && parts.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      setEditingPart({
        project_id: projectId,
        supplier_name: "",
        order_reference: "",
        order_date: today,
        estimated_arrival_date: "",
        status: "Pending",
        notes: "",
        attachment_urls: []
      });
      setShowForm(true);
    }
  }, [autoExpand, parts.length, projectId]);

  useEffect(() => {
    if (showForm && supplierNameRef.current) {
      setTimeout(() => supplierNameRef.current?.focus(), 100);
    }
  }, [showForm]);

  const handleAddPart = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingPart({
      project_id: projectId,
      supplier_name: "",
      order_reference: "",
      order_date: today,
      estimated_arrival_date: "",
      status: "Pending",
      notes: "",
      attachment_urls: []
    });
    setShowForm(true);
  };

  const handleEditPart = (part) => {
    setEditingPart(part);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563]">
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
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-6 text-center">
              <p className="text-[14px] text-[#6B7280] mb-3">No parts orders yet</p>
              <Button onClick={handleAddPart} className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                Add Part Order
              </Button>
            </CardContent>
          </Card>
        ) : (
          parts.map((part) => (
            <Card key={part.id} className="border border-[#E5E7EB] hover:border-[#FAE008] transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-[16px] font-semibold text-[#111827]">{part.supplier_name || "Unnamed Supplier"}</h4>
                      <Badge className={`${statusColors[part.status]} font-medium border px-2.5 py-0.5 rounded-lg text-[12px]`}>
                        {part.status}
                      </Badge>
                    </div>
                    {part.order_reference && (
                      <p className="text-[14px] text-[#4B5563]">Order Ref: {part.order_reference}</p>
                    )}
                    {part.estimated_arrival_date && (
                      <p className="text-[14px] text-[#4B5563]">
                        ETA: {new Date(part.estimated_arrival_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditPart(part)}
                      className="h-8 w-8 hover:bg-[#F3F4F6]"
                    >
                      <Edit className="w-4 h-4 text-[#6B7280]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePartMutation.mutate(part.id)}
                      className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <PartFormDialog
        open={showForm}
        part={editingPart}
        onClose={() => {
          setShowForm(false);
          setEditingPart(null);
        }}
        onSubmit={(data) => {
          if (editingPart?.id) {
            updatePartMutation.mutate({ id: editingPart.id, data });
          } else {
            createPartMutation.mutate(data);
          }
        }}
        isSubmitting={createPartMutation.isPending || updatePartMutation.isPending}
        supplierNameRef={supplierNameRef}
      />
    </div>
  );
}

function PartFormDialog({ open, part, onClose, onSubmit, isSubmitting, supplierNameRef }) {
  const [formData, setFormData] = useState(part || {});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (part) {
      setFormData(part);
    }
  }, [part]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(result => result.file_url);
      
      setFormData({
        ...formData,
        attachment_urls: [...(formData.attachment_urls || []), ...newUrls]
      });
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploading(false);
  };

  const removeAttachment = (indexToRemove) => {
    setFormData({
      ...formData,
      attachment_urls: formData.attachment_urls.filter((_, index) => index !== indexToRemove)
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-semibold text-[#111827]">
            {part?.id ? 'Edit Part Order' : 'New Part Order'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier_name">Supplier Name *</Label>
            <Input
              id="supplier_name"
              ref={supplierNameRef}
              value={formData.supplier_name || ""}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              required
              placeholder="Enter supplier name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="order_reference">Order Reference</Label>
            <Input
              id="order_reference"
              value={formData.order_reference || ""}
              onChange={(e) => setFormData({ ...formData, order_reference: e.target.value })}
              placeholder="Enter order reference"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_date">Order Date</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date || ""}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_arrival_date">ETA</Label>
              <Input
                id="estimated_arrival_date"
                type="date"
                value={formData.estimated_arrival_date || ""}
                onChange={(e) => setFormData({ ...formData, estimated_arrival_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status || "Pending"}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Ordered">Ordered</SelectItem>
                <SelectItem value="Back-ordered">Back-ordered</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <TextField
              label="Notes"
              multiline
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add notes about this order..."
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            {formData.attachment_urls && formData.attachment_urls.length > 0 && (
              <div className="space-y-2">
                {formData.attachment_urls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-[#F8F9FA] rounded-lg border border-[#E5E7EB]">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[14px] text-[#111827] hover:underline truncate"
                    >
                      Attachment {index + 1}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:bg-red-50 rounded p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Files'}
                </span>
              </Button>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
              {isSubmitting ? 'Saving...' : part?.id ? 'Update Part' : 'Create Part'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}