import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sameId } from "@/components/utils/id";
import { invalidatePurchaseOrderBundle } from "@/components/api/invalidate";
import * as purchaseOrdersApi from "@/components/api/purchaseOrdersApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Package, Truck, Save, Send, ArrowRight, List, ShoppingCart, Upload, FileText, Calendar, Trash } from "lucide-react";
import { toast } from "sonner";
import { PO_STATUS, PO_STATUS_OPTIONS, PO_STATUS_OPTIONS_NON_PROJECT, PO_STATUS_OPTIONS_PROJECT, getPoStatusLabel, getPoStatusColor, normaliseLegacyPoStatus } from "@/components/domain/purchaseOrderStatusConfig";
import { DELIVERY_METHOD as PO_DELIVERY_METHOD, DELIVERY_METHOD_OPTIONS as PO_DELIVERY_METHOD_OPTIONS } from "@/components/domain/supplierDeliveryConfig";
import { PART_CATEGORIES } from "@/components/domain/partConfig";
import { getPoDisplayReference, validatePoIdentityFields, getPoIdentity } from "@/components/domain/poDisplayHelpers";
import { setPoEtaPayload } from "@/components/domain/schemaAdapters";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { usePermissions, PERMISSIONS } from "@/components/auth/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function PurchaseOrderDetail({ poId, onClose, mode = "page" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const isModal = mode === "modal";
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: "",
    project_id: "",
    delivery_method: "",
    notes: "",
    po_reference: "",
    name: "",
    status: PO_STATUS.DRAFT,
    eta: "",
    attachments: [],
    line_items: []
  });
  const [uploading, setUploading] = useState(false);

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchaseOrder', poId],
    queryFn: () => base44.entities.PurchaseOrder.get(poId),
    enabled: !!poId,
    refetchOnMount: true
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });

  const linkedProject = projects.find(p => sameId(p.id, formData.project_id));

  const { data: linkedJob } = useQuery({
    queryKey: ['linkedJob', po?.linked_logistics_job_id],
    queryFn: () => base44.entities.Job.get(po.linked_logistics_job_id),
    enabled: !!po?.linked_logistics_job_id
  });

  // Fetch additional data for line item sources
  const { data: lineItems = [] } = useQuery({
    queryKey: ['purchaseOrderLines', poId],
    queryFn: () => base44.entities.PurchaseOrderLine.filter({ purchase_order_id: poId }),
    enabled: !!poId,
    refetchOnMount: true
  });

  const { data: projectParts = [] } = useQuery({
    queryKey: ['projectParts', formData.project_id],
    queryFn: () => base44.entities.Part.filter({ project_id: formData.project_id }),
    enabled: !!formData.project_id
  });

  const priceListQuery = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.filter({ is_active: true }),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => err?.status !== 429 && count < 2,
  });
  const priceListItems = priceListQuery.data || [];

  const initialLoadDone = React.useRef(false);

  // Reset initial load flag when poId changes
  React.useEffect(() => {
    initialLoadDone.current = false;
    setIsDirty(false);
  }, [poId]);

  // Helper: Apply returned PO to both cache and formData
  const applyReturnedPO = (returnedPO) => {
    if (!returnedPO?.id) {
      console.warn("[applyReturnedPO] No PO returned");
      return;
    }

    console.log("[applyReturnedPO]", {
      returned_po_reference: returnedPO.po_reference,
      returned_name: returnedPO.name
    });

    // 1) Update the query cache so `po` in render updates immediately
    queryClient.setQueryData(["purchaseOrder", poId], returnedPO);

    // 2) Sync formData with returned PO - explicitly use returned values
    setFormData(prev => ({
      ...prev,
      supplier_id: returnedPO.supplier_id ?? prev.supplier_id,
      project_id: returnedPO.project_id ?? prev.project_id,
      delivery_method: returnedPO.delivery_method ?? prev.delivery_method,
      notes: returnedPO.notes ?? prev.notes,
      po_reference: returnedPO.po_reference ?? "",
      name: returnedPO.name ?? "",
      status: normaliseLegacyPoStatus(returnedPO.status ?? prev.status),
      eta: returnedPO.expected_date ?? prev.eta,
      attachments: returnedPO.attachments ?? prev.attachments,
    }));
  };

  useEffect(() => {
    if (po && lineItems && !initialLoadDone.current) {
      // Normalize legacy status
      const normalizedStatus = normaliseLegacyPoStatus(po.status);
      
      // Map line items from separate entity (source of truth)
      const items = lineItems.map(line => ({
        id: line.id,
        source_type: line.source_type || "custom",
        source_id: line.source_id || line.price_list_item_id || null,
        part_id: line.part_id || null,
        name: line.item_name || line.description || '',
        quantity: line.qty_ordered || 0,
        unit_price: line.unit_cost_ex_tax || 0,
        unit: line.unit || null,
        notes: line.notes || null,
        category: line.category || "Other"
      }));

      // Only run once on initial load - never overwrite user input after that
      setFormData({
        supplier_id: po.supplier_id || "",
        project_id: po.project_id || "",
        delivery_method: po.delivery_method || "",
        notes: po.notes || "",
        po_reference: po.po_reference || "",
        name: po.name || "",
        status: normalizedStatus,
        eta: po.expected_date || "",
        attachments: po.attachments || [],
        line_items: items
      });
      setIsEditing(normalizedStatus === PO_STATUS.DRAFT);
      setIsDirty(false);
      initialLoadDone.current = true;
    } else if (po && lineItems && initialLoadDone.current && !isDirty) {
      // PO updated from backend (e.g., after save) - rehydrate if not dirty
      const normalizedStatus = normaliseLegacyPoStatus(po.status);
      const items = lineItems.map(line => ({
        id: line.id,
        source_type: line.source_type || "custom",
        source_id: line.source_id || line.price_list_item_id || null,
        part_id: line.part_id || null,
        name: line.item_name || line.description || '',
        quantity: line.qty_ordered || 0,
        unit_price: line.unit_cost_ex_tax || 0,
        unit: line.unit || null,
        notes: line.notes || null,
        category: line.category || "Other"
      }));

      setFormData({
        supplier_id: po.supplier_id || "",
        project_id: po.project_id || "",
        delivery_method: po.delivery_method || "",
        notes: po.notes || "",
        po_reference: po.po_reference || "",
        name: po.name || "",
        status: normalizedStatus,
        eta: po.expected_date || "",
        attachments: po.attachments || [],
        line_items: items
      });
    }
  }, [po?.id, po, lineItems, isDirty]);



  const createLogisticsJobMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('createLogisticsJobForPO', {
        purchase_order_id: poId
      });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to create logistics job');
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success('Logistics job created');
      if (data.job?.id) {
        navigate(`${createPageUrl("Jobs")}?jobId=${data.job.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create logistics job');
    }
    });

    const deletePOMutation = useMutation({
    mutationFn: async () => {
      return await purchaseOrdersApi.deletePurchaseOrder({ id: poId });
    },
    onSuccess: async () => {
      const projectId = po?.project_id;
      await Promise.all([
        invalidatePurchaseOrderBundle(queryClient, poId),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] }),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
        projectId && queryClient.invalidateQueries({ queryKey: ['projectPurchaseOrders', projectId] }),
        projectId && queryClient.invalidateQueries({ queryKey: ['projectPOLines', projectId] })
      ].filter(Boolean));
      toast.success('Purchase Order deleted');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete Purchase Order');
    }
    });

    const handleDelete = () => {
    const confirmMessage = isDraft 
      ? 'Are you sure you want to delete this draft Purchase Order? This action cannot be undone.'
      : 'Are you sure you want to delete this Purchase Order? This action cannot be undone.';
    
    if (confirm(confirmMessage)) {
      deletePOMutation.mutate();
    }
    };

    const saveIdentityMutation = useMutation({
    mutationFn: async () => {
      // Validate identity fields
      const validation = validatePoIdentityFields({
        po_reference: formData.po_reference,
        supplier_id: formData.supplier_id
      });
      
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      return await purchaseOrdersApi.updateIdentity({
        id: poId,
        po_reference: formData.po_reference?.trim() || "",
        name: formData.name?.trim() || "",
        supplier_id: formData.supplier_id,
        notes: formData.notes || "",
        expected_date: formData.eta || null
      });
    },
    onSuccess: async (updatedPO) => {
      // Apply returned PO to cache and form
      applyReturnedPO(updatedPO);

      // Invalidate all PO-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] }),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
        updatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPurchaseOrders', updatedPO.project_id] })
      ].filter(Boolean));

      setIsDirty(false);
      toast.success("Purchase Order saved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save Purchase Order");
    }
  });

  const handleSave = async () => {
    // If line items have changed, save them as well
    if (formData.line_items.length > 0) {
      try {
        // Step 1: Update identity
        const updatedPO = await purchaseOrdersApi.updateIdentity({
          id: poId,
          po_reference: formData.po_reference?.trim() || "",
          name: formData.name?.trim() || "",
          supplier_id: formData.supplier_id,
          notes: formData.notes || "",
          expected_date: formData.eta || null
        });

        // Step 2: Update line items
        const finalPO = await purchaseOrdersApi.setLineItems({
          id: poId,
          line_items: formData.line_items.map(item => ({
            source_type: item.source_type || "custom",
            source_id: item.source_id || null,
            part_id: item.part_id || null,
            item_name: item.name || '',
            quantity: item.quantity || 0,
            unit_price: item.unit_price || 0,
            unit: item.unit || null,
            notes: item.notes || null,
            category: item.category || "Other"
          }))
        });

        applyReturnedPO(finalPO);

        await Promise.all([
          invalidatePurchaseOrderBundle(queryClient, poId),
          queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] }),
          queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
          queryClient.invalidateQueries({ queryKey: ['purchaseOrderLines', poId] }),
          finalPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPurchaseOrders', finalPO.project_id] }),
          finalPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPOLines', finalPO.project_id] }),
          queryClient.invalidateQueries({ queryKey: ['parts'] })
        ].filter(Boolean));

        setIsDirty(false);
        toast.success("Purchase Order saved");
      } catch (error) {
        toast.error(error.message || "Failed to save Purchase Order");
      }
    } else {
      // Only identity changes
      saveIdentityMutation.mutate();
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return file_url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newAttachments = [...formData.attachments, ...uploadedUrls];
      
      setFormData((prev) => ({
        ...prev,
        attachments: newAttachments
      }));

      // Auto-save attachments via updateIdentity
      await purchaseOrdersApi.updateIdentity({
        id: poId,
        po_reference: formData.po_reference,
        name: formData.name,
        supplier_id: formData.supplier_id,
        notes: formData.notes,
        expected_date: formData.eta
      });
      
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      toast.success(`${files.length} file(s) uploaded`);
      
      // Reset input to allow uploading same file again
      e.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
      e.target.value = '';
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (index) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      attachments: newAttachments
    }));
    
    // Auto-save after removing via updateIdentity
    try {
      await purchaseOrdersApi.updateIdentity({
        id: poId,
        po_reference: formData.po_reference,
        name: formData.name,
        supplier_id: formData.supplier_id,
        notes: formData.notes,
        expected_date: formData.eta
      });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      toast.success('Attachment removed');
    } catch (error) {
      toast.error('Failed to remove attachment');
    }
  };

  const handleSendToSupplier = async () => {
    // Validate identity fields
    const validation = validatePoIdentityFields({
      po_reference: formData.po_reference,
      supplier_id: formData.supplier_id
    });
    
    if (!validation.valid) {
      validation.errors.forEach(err => toast.error(err));
      return;
    }
    
    if (formData.line_items.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }
    
    try {
      // Step 1: Persist all field edits via updateIdentity
      await purchaseOrdersApi.updateIdentity({
        id: poId,
        po_reference: formData.po_reference?.trim() || "",
        name: formData.name?.trim() || "",
        supplier_id: formData.supplier_id,
        notes: formData.notes || "",
        expected_date: formData.eta || null
      });
      
      // Step 2: Update status to ON_ORDER
      const statusUpdatedPO = await purchaseOrdersApi.updateStatus({
        id: poId,
        status: PO_STATUS.ON_ORDER
      });

      // Apply returned PO
      applyReturnedPO(statusUpdatedPO);

      // Invalidate all PO-related caches
      await Promise.all([
        invalidatePurchaseOrderBundle(queryClient, poId),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] }),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
        queryClient.invalidateQueries({ queryKey: ['purchaseOrderLines', poId] }),
        statusUpdatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPurchaseOrders', statusUpdatedPO.project_id] }),
        statusUpdatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPOLines', statusUpdatedPO.project_id] }),
        queryClient.invalidateQueries({ queryKey: ['parts'] })
      ].filter(Boolean));
      
      setIsDirty(false);
      toast.success('Purchase Order sent to supplier');
    } catch (error) {
      console.error('[Send to Supplier - ERROR]', error);
      toast.error(error.message || 'Failed to send Purchase Order');
    }
  };

  const handleCreateLogisticsJob = () => {
    createLogisticsJobMutation.mutate();
  };

  const [addItemMenuOpen, setAddItemMenuOpen] = useState(false);
  const [priceListSearch, setPriceListSearch] = useState("");

  const addLineItemMutation = useMutation({
    mutationFn: async (newItem) => {
      // Update local state optimistically
      setFormData(prev => ({
        ...prev,
        line_items: [...prev.line_items, newItem]
      }));
      
      // Let save handler persist via manageLineItems
      setIsDirty(true);
      return newItem;
    },
    onSuccess: () => {
      toast.success('Item added - click Save to persist');
    },
    onError: (error) => {
      toast.error('Failed to add item');
    }
  });

  const addLineItem = (sourceType = "custom", sourceItem = null) => {
    const newItem = { 
      source_type: sourceType,
      source_id: sourceItem?.id || null,
      part_id: sourceType === "project_part" ? sourceItem?.id : null,
      name: sourceItem?.item || sourceItem?.category || '', 
      quantity: sourceType === "project_part" ? (sourceItem?.quantity_required || 1) : 1, 
      unit_price: sourceItem?.unit_cost || sourceItem?.price || 0,
      unit: null,
      notes: null,
      category: sourceItem?.category || "Other"
    };
    
    // Save immediately to database if not draft
    if (isDraft) {
      addLineItemMutation.mutate(newItem);
    } else {
      // For non-draft, just update UI state
      setFormData({
        ...formData,
        line_items: [...formData.line_items, newItem]
      });
    }
    setAddItemMenuOpen(false);
  };

  const removeLineItemMutation = useMutation({
    mutationFn: async (lineId) => {
      // Update local state optimistically
      setFormData(prev => ({
        ...prev,
        line_items: prev.line_items.filter(item => !sameId(item.id, lineId))
      }));
      
      // Let save handler persist via manageLineItems
      setIsDirty(true);
      return lineId;
    },
    onSuccess: () => {
      toast.success('Item removed - click Save to persist');
    },
    onError: () => {
      toast.error('Failed to remove item');
    }
  });

  const removeLineItem = (index) => {
    const item = formData.line_items[index];
    
    // If item has an ID, delete from database
    if (item.id && isDraft) {
      removeLineItemMutation.mutate(item.id);
    } else {
      // Otherwise just update UI state
      setFormData({
        ...formData,
        line_items: formData.line_items.filter((_, i) => i !== index)
      });
    }
  };

  const updateLineItemMutation = useMutation({
    mutationFn: async ({ lineId, updates }) => {
      // Let save handler persist via manageLineItems
      setIsDirty(true);
      return updates;
    },
    onSuccess: async () => {
      // No immediate save - wait for user to click Save button
    }
  });

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...formData.line_items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, line_items: updatedItems });
    
    // Auto-save to database if item has ID (persisted) and we're in draft mode
    const item = updatedItems[index];
    if (item.id && isDraft) {
      // Debounced save
      clearTimeout(window._lineItemSaveTimeout);
      window._lineItemSaveTimeout = setTimeout(() => {
        updateLineItemMutation.mutate({
          lineId: item.id,
          updates: item
        });
      }, 500);
    }
  };



  const calculateTotal = () => {
    return formData.line_items.reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-[#6B7280]">Loading purchase order...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-[#DC2626]">Purchase order not found</p>
      </div>
    );
  }

  // Debug: Pinpoint render-time data source
  console.log("[PO DETAIL]", {
    po_ref_from_query: po?.po_reference ?? null,
    po_ref_from_form: formData.po_reference ?? '',
    display: getPoDisplayReference(po),
  });

  const isDraft = po.status === PO_STATUS.DRAFT;
  const isProjectPO = !!formData.project_id;
  const availableStatuses = isProjectPO ? PO_STATUS_OPTIONS_PROJECT : PO_STATUS_OPTIONS_NON_PROJECT;
  
  const canCreateLogistics = [
    PO_STATUS.ON_ORDER,
    PO_STATUS.IN_TRANSIT,
    PO_STATUS.IN_LOADING_BAY,
  ].includes(formData.status);

  const containerClass = isModal 
    ? "bg-white"
    : "bg-white min-h-screen";

  return (
    <div className={containerClass}>
      {!isModal && (
        <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[#111827]">Purchase Order</h2>
                  <Badge className={getPoStatusColor(formData.status)}>{getPoStatusLabel(formData.status)}</Badge>
                </div>
                {isDraft ? (
                <Input
                  value={formData.po_reference}
                  onChange={(e) => {
                    setFormData({ ...formData, po_reference: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder="Enter PO reference..."
                  className="mt-2 max-w-xs text-sm"
                />
                ) : (
                 <div className="mt-2 space-y-1">
                   <div className="flex items-center gap-2">
                     <p className="text-sm font-medium text-[#111827]">
                       {getPoIdentity(po).reference}
                     </p>
                     {(formData.po_reference?.trim() !== (po.po_reference || '') || 
                       formData.name?.trim() !== (po.name || '')) && (
                       <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                         Unsaved changes
                       </Badge>
                     )}
                   </div>
                   {getPoIdentity(po).name && (
                     <p className="text-sm text-[#6B7280]">{getPoIdentity(po).name}</p>
                   )}
                 </div>
                )}
                {linkedProject && (
                 <p className="text-sm text-[#6B7280] mt-1">
                   Project: {linkedProject.title}
                 </p>
                )}
                </div>
                </div>
                <div className="flex gap-2">
                {(isDraft || can(PERMISSIONS.DELETE_PO)) && (
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={deletePOMutation.isPending}
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
                {isDirty && (
                 <Button
                   type="button"
                   onClick={handleSave}
                   disabled={!formData.po_reference?.trim() || saveIdentityMutation.isPending}
                   className="bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]"
                 >
                   <Save className="w-4 h-4 mr-2" />
                   Save Changes
                 </Button>
                )}
                {isDraft && (
                 <Button
                   type="button"
                   onClick={handleSendToSupplier}
                   disabled={!formData.po_reference?.trim()}
                   className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                 >
                   <Send className="w-4 h-4 mr-2" />
                   Send to Supplier
                 </Button>
                )}
            </div>
          </div>
        </div>
      )}

      <div className={isModal ? "space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto" : "p-6 space-y-6 max-w-4xl mx-auto"}>
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[18px]">Purchase Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PO Reference</Label>
                <Input
                  value={formData.po_reference}
                  onChange={(e) => {
                    setFormData({ ...formData, po_reference: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder="e.g. KGD-RSH-4634"
                />
              </div>
            </div>

            <div>
              <Label>Name/Description</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setIsDirty(true);
                }}
                placeholder="e.g., Garage Door Parts Order"
              />
            </div>

            {isDraft && !po ? (
              <div>
                <Label>Supplier *</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, supplier_id: value });
                    setIsDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Supplier</Label>
                <div className="px-3 py-2.5 bg-[#F3F4F6] rounded-lg text-[#111827] text-sm">
                  {suppliers.find(s => sameId(s.id, formData.supplier_id))?.name || 'No supplier selected'}
                </div>
              </div>
            )}

            <div>
              <Label>Project (Optional)</Label>
              <Select
                value={formData.project_id || "none"}
                onValueChange={(value) => {
                  setFormData({ ...formData, project_id: value === "none" ? "" : value });
                  setIsDirty(true);
                }}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.filter(p => !p.deleted_at).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Delivery Method</Label>
              <Select
                value={formData.delivery_method || "placeholder"}
                onValueChange={(value) => {
                  setFormData({ ...formData, delivery_method: value === "placeholder" ? "" : value });
                  setIsDirty(true);
                }}
                disabled={!isDraft}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder">Select delivery method</SelectItem>
                  {PO_DELIVERY_METHOD_OPTIONS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={async (value) => {
                  setFormData((prev) => ({ ...prev, status: value }));

                  try {
                    const updatedPO = await purchaseOrdersApi.updateStatus({
                      id: po.id,
                      status: value
                    });

                    // Apply returned PO to both cache and formData
                    applyReturnedPO(updatedPO);

                    // Invalidate all PO-related caches
                    await Promise.all([
                      invalidatePurchaseOrderBundle(queryClient, poId),
                      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] }),
                      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
                      queryClient.invalidateQueries({ queryKey: ['purchaseOrderLines', poId] }),
                      updatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPurchaseOrders', updatedPO.project_id] }),
                      updatedPO.project_id && queryClient.invalidateQueries({ queryKey: ['projectPOLines', updatedPO.project_id] }),
                      queryClient.invalidateQueries({ queryKey: ['parts'] }),
                      queryClient.invalidateQueries({ queryKey: ['allJobs'] }),
                      queryClient.invalidateQueries({ queryKey: ['linkedJob', updatedPO.linked_logistics_job_id] })
                    ].filter(Boolean));

                    toast.success("Status updated");
                  } catch (error) {
                    setFormData((prev) => ({ ...prev, status: po.status }));
                    toast.error(error.message || "Error updating status");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status">
                    {getPoStatusLabel(formData.status)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getPoStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>ETA (Expected Date)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                <Input
                  type="date"
                  value={formData.eta}
                  onChange={(e) => {
                    setFormData({ ...formData, eta: e.target.value });
                    setIsDirty(true);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Attachments</Label>
              <div className="space-y-2">
                {formData.attachments.length > 0 && (
                  <div className="space-y-1">
                    {formData.attachments.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-[#F3F4F6] rounded-lg">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline flex-1 truncate"
                        >
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{url.split('/').pop()}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="attachment-upload"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('attachment-upload').click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Files'}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => {
                  setFormData({ ...formData, notes: e.target.value });
                  setIsDirty(true);
                }}
                placeholder="Add any notes or special instructions..."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[18px]">Line Items</CardTitle>
              {isDraft && (
                <Popover open={addItemMenuOpen} onOpenChange={setAddItemMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="end">
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addLineItem("custom")}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Custom Item
                      </Button>
                      <div className="border-t my-1" />
                      {priceListItems?.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-2 py-1 text-xs font-medium text-[#6B7280]">From Price List</div>
                          <Input
                            placeholder="Search items..."
                            value={priceListSearch}
                            onChange={(e) => setPriceListSearch(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {priceListItems && priceListItems
                              .filter(item => 
                                !priceListSearch || 
                                item.item?.toLowerCase().includes(priceListSearch.toLowerCase()) ||
                                item.sku?.toLowerCase().includes(priceListSearch.toLowerCase())
                              )
                              .map((item) => (
                                <Button
                                  type="button"
                                  key={item.id}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-xs"
                                  onClick={() => {
                                    addLineItem("price_list", item);
                                    setPriceListSearch("");
                                  }}
                                >
                                  <List className="w-3 h-3 mr-2" />
                                  {item.item}
                                </Button>
                              ))}
                          </div>
                        </div>
                      )}
                      {projectParts.length > 0 && (
                        <>
                          <div className="border-t my-1" />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            <div className="px-2 py-1 text-xs font-medium text-[#6B7280]">From Project Parts</div>
                            {projectParts.map((part) => (
                              <Button
                                type="button"
                                key={part.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs"
                                onClick={() => addLineItem("project_part", part)}
                              >
                                <ShoppingCart className="w-3 h-3 mr-2" />
                                {part.category}
                              </Button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {formData.line_items.length === 0 ? (
              <p className="text-[#6B7280] text-sm text-center py-4">
                No line items yet. Click "Add Item" to start.
              </p>
            ) : (
              <div className="space-y-3">
                {formData.line_items.map((item, index) => (
                  <div key={item.id || index} className="border rounded-lg p-3">
                    {/* Source Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {item.source_type === "price_list" && "Price List"}
                        {item.source_type === "project_part" && "Project Part"}
                        {item.source_type === "stock_item" && "Stock Item"}
                        {item.source_type === "custom" && "Custom"}
                      </Badge>
                      {isDraft && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(index)}
                                  disabled={!can(PERMISSIONS.DELETE_LINE_ITEM)}
                                  className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </span>
                            </TooltipTrigger>
                            {!can(PERMISSIONS.DELETE_LINE_ITEM) && (
                              <TooltipContent>
                                <p>Insufficient permissions</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="space-y-2">
                      <Input
                        placeholder="Item name/description"
                        value={item.name || ''}
                        onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                        disabled={!isDraft}
                        className="font-medium"
                      />
                      <div>
                        <Label className="text-xs text-[#6B7280]">Category</Label>
                        <Select
                          value={item.category || "Other"}
                          onValueChange={(value) => updateLineItem(index, 'category', value)}
                          disabled={!isDraft}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {PART_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-[#6B7280]">Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            disabled={!isDraft}
                            min="0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-[#6B7280]">Unit Price</Label>
                          <Input
                            type="number"
                            value={item.unit_price || ''}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            disabled={!isDraft}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-[#6B7280]">Total</Label>
                          <div className="h-10 flex items-center justify-end px-3 bg-[#F3F4F6] rounded-lg">
                            <span className="text-sm font-semibold">
                              ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isDraft && (
                        <Input
                          placeholder="Notes (optional)"
                          value={item.notes || ''}
                          onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-3 border-t">
                  <div className="text-right">
                    <span className="text-sm text-[#6B7280]">Total: </span>
                    <span className="text-lg font-bold text-[#111827]">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logistics Section */}
        {canCreateLogistics && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[18px] flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Logistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {po.linked_logistics_job_id ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B7280]">
                    A logistics job has been created for this purchase order.
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${po.linked_logistics_job_id}`)}
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    View Logistics Job {linkedJob?.job_number ? `#${linkedJob.job_number}` : ''}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B7280]">
                    Create a logistics job to track delivery from {formData.delivery_method === 'Supplier → Pickup Required' ? 'supplier pickup' : 'supplier to warehouse'}.
                  </p>
                  <Button
                    type="button"
                    onClick={handleCreateLogisticsJob}
                    disabled={createLogisticsJobMutation.isPending}
                    className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Create Logistics Job
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}