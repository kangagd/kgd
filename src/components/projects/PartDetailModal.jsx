import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Upload, FileText, Link as LinkIcon, Plus, Search, Trash2, Package, Truck, ArrowRight, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RichTextEditor from "../common/RichTextEditor";
import { format } from "date-fns";
import { toast } from "sonner";
import { PART_STATUS, PART_STATUS_OPTIONS, PART_LOCATION, PART_LOCATION_OPTIONS, getPartStatusLabel, getPartLocationLabel, normaliseLegacyPartStatus, normaliseLegacyPartLocation } from "@/components/domain/partConfig";
import { SOURCE_TYPE, SOURCE_TYPE_OPTIONS, SOURCE_TYPE_LABELS, getSourceTypeLabel, normaliseLegacySourceType } from "@/components/domain/supplierDeliveryConfig";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
  "Door", "Motor", "Posts", "Tracks", "Small Parts", "Hardware", "Other"
];

export default function PartDetailModal({ open, part, onClose, onSave, isSubmitting, projectId }) {
  // Initialize with defaults to avoid blank fields
  const [formData, setFormData] = useState({
    category: "Other",
    status: PART_STATUS.PENDING,
    source_type: SOURCE_TYPE.SUPPLIER_DELIVERY,
    location: PART_LOCATION.SUPPLIER,
    order_date: new Date().toISOString().split('T')[0],
    linked_logistics_jobs: [],
    attachments: [],
    price_list_item_id: null,
    assigned_vehicle_id: null,
    supplier_id: null,
    supplier_name: "",
    quantity_required: 1,
    notes: "",
    tracking_url: ""
  });
  const [uploading, setUploading] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [priceListSearch, setPriceListSearch] = useState("");
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [poError, setPoError] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch linked PO if part has one
  const { data: linkedPO } = useQuery({
    queryKey: ['linkedPO', part?.purchase_order_id],
    queryFn: () => part?.purchase_order_id 
      ? base44.entities.PurchaseOrder.get(part.purchase_order_id)
      : null,
    enabled: !!part?.purchase_order_id && open
  });

  // Fetch price list items FIRST (needed by useEffect below)
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems-for-parts'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
    enabled: open
  });

  const movePartMutation = useMutation({
    mutationFn: ({ part_ids, from_location, to_location }) => 
      base44.functions.invoke('recordStockMovement', {
        part_ids,
        from_location,
        to_location,
        project_id: part?.project_id
      }),
    onSuccess: (response) => {
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['parts'] });
        toast.success("Part moved successfully");
        onClose();
      } else {
        toast.error(response.data?.error || "Failed to move part");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to move part");
    }
  });

  useEffect(() => {
    if (!open) return; // Don't run if modal isn't open
    
    if (part) {
      console.log("PartDetailModal received part:", part);
      // Map legacy fields if they exist and new ones are empty
      const mappedPart = {
        ...part,
        // If eta is missing but estimated_arrival_date exists, use it
        eta: part.eta || part.estimated_arrival_date || "",
        // If attachments is missing but attachment_urls exists, use it
        attachments: part.attachments || part.attachment_urls || [],
        // Ensure arrays are initialized
        linked_logistics_jobs: part.linked_logistics_jobs || [],
        category: part.category || "Other",
        status: part.status || "Pending",
        source_type: part.source_type || "Supplier – Deliver to Warehouse",
        location: part.location || "On Order",
        order_date: part.order_date || (part.id ? "" : new Date().toISOString().split('T')[0]),
        price_list_item_id: part.price_list_item_id || null,
        assigned_vehicle_id: part.assigned_vehicle_id || null,
        supplier_id: part.supplier_id || null,
        supplier_name: part.supplier_name || "",
        quantity_required: part.quantity_required || 1,
        notes: part.notes || "",
        tracking_url: part.tracking_url || ""
      };
      console.log("Setting formData to:", mappedPart);
      setFormData(mappedPart);
      
      // If part has a price list item, set the search to display it
      if (part.price_list_item_id) {
        const linkedItem = priceListItems.find(item => item.id === part.price_list_item_id);
        if (linkedItem) {
          setPriceListSearch(linkedItem.item);
        }
      }
    } else {
      console.log("PartDetailModal: Creating new part (no part data)");
      setFormData({
        category: "Other",
        status: PART_STATUS.PENDING,
        source_type: SOURCE_TYPE.SUPPLIER_DELIVERY,
        location: PART_LOCATION.SUPPLIER,
        order_date: new Date().toISOString().split('T')[0],
        linked_logistics_jobs: [],
        attachments: [],
        price_list_item_id: null,
        assigned_vehicle_id: null,
        supplier_id: null,
        supplier_name: "",
        quantity_required: 1,
        notes: "",
        tracking_url: ""
      });
      setPriceListSearch("");
    }
    setPoError("");
    setPriceListOpen(false);
  }, [part?.id, open, priceListItems]);

  // Fetch jobs for logistics linking
  const { data: jobs = [] } = useQuery({
    queryKey: ['activeJobs'],
    queryFn: () => base44.entities.Job.filter({ status: { $ne: 'Cancelled' } }),
    enabled: open
  });

  // Fetch vehicles for parts
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-for-parts'],
    queryFn: () => base44.entities.Vehicle.list('name'),
    enabled: open
  });

  // Fetch active suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['activeSuppliers-parts'],
    queryFn: () => base44.entities.Supplier.list('name'),
    enabled: open
  });

  // Get selected item name for display
  const selectedPriceListItem = priceListItems.find(item => item.id === formData.price_list_item_id);
  const displayValue = formData.price_list_item_id 
    ? (selectedPriceListItem?.item || "Loading...") 
    : priceListSearch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPoError("");

    const isSupplierSource = 
      formData.source_type === SOURCE_TYPE.SUPPLIER_DELIVERY ||
      formData.source_type === SOURCE_TYPE.SUPPLIER_PICKUP;

    // Validate supplier is set if supplier source
    if (isSupplierSource && !formData.supplier_id) {
      setPoError("Supplier is required for this source type");
      return;
    }

    try {
      // Save/create the Part
      const savedPart = await onSave(formData);
      
      // No longer create PO here - user will use "Create PO" button from PartsSection
      // or navigate to existing PO to add this part
      
      toast.success("Part saved");
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to save part");
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(result => result.file_url);
      
      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...newUrls]
      }));
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploading(false);
  };

  const removeAttachment = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, index) => index !== indexToRemove)
    }));
  };

  const toggleLogisticsJob = (jobId) => {
    const currentLinks = formData.linked_logistics_jobs || [];
    if (currentLinks.includes(jobId)) {
      setFormData(prev => ({
        ...prev,
        linked_logistics_jobs: currentLinks.filter(id => id !== jobId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        linked_logistics_jobs: [...currentLinks, jobId]
      }));
    }
  };

  // Filter jobs for dropdown
  const filteredJobs = jobs.filter(job => {
    const searchLower = jobSearch.toLowerCase();
    return (
      job.job_number?.toString().includes(searchLower) ||
      job.job_type_name?.toLowerCase().includes(searchLower) ||
      job.job_type?.toLowerCase().includes(searchLower) ||
      job.customer_name?.toLowerCase().includes(searchLower)
    );
  }).slice(0, 20); // Limit results

  const linkedJobsData = jobs.filter(job => (formData.linked_logistics_jobs || []).includes(job.id));

  const handleMovePart = (toLocation) => {
    if (!part?.id) {
      toast.error("Save the part first before moving");
      return;
    }
    const fromLocation = normaliseLegacyPartLocation(part.location) || PART_LOCATION.DELIVERY_BAY;
    movePartMutation.mutate({
      part_ids: [part.id],
      from_location: fromLocation,
      to_location: toLocation
    });
  };

  const isInLoadingBay = normaliseLegacyPartLocation(part?.location) === PART_LOCATION.DELIVERY_BAY;
  const isOnVehicle = normaliseLegacyPartLocation(part?.location) === PART_LOCATION.VEHICLE;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
          <DialogTitle className="text-[22px] font-semibold text-[#111827]">
            {part?.id ? 'Part Details' : 'New Part'}
          </DialogTitle>
          
          {/* PO Linkage Status */}
          {part?.purchase_order_id ? (
            <div className="mt-3 flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs bg-white">
                  Linked to PO #{linkedPO?.po_number || part.purchase_order_id.slice(0, 8)}
                </Badge>
                {linkedPO?.status && (
                  <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                    {linkedPO.status}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`${createPageUrl("PurchaseOrders")}?poId=${part.purchase_order_id}`);
                }}
                className="bg-white"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open PO
              </Button>
            </div>
          ) : part?.id ? (
            <div className="mt-3 text-xs text-[#6B7280] bg-slate-50 border border-slate-200 rounded-lg p-3">
              This part is not yet linked to a Purchase Order. To order it, use the "Create PO" button in the Project Parts section and add this part in the PO screen.
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="part-form" onSubmit={handleSubmit} className="p-6 space-y-8">
            
            {/* Part Overview */}
            <section className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Part Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Linked Price List Item (optional)</Label>
                  <Popover open={priceListOpen} onOpenChange={setPriceListOpen}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={displayValue}
                          onChange={(e) => {
                            setPriceListSearch(e.target.value);
                            if (formData.price_list_item_id) {
                              setFormData(prev => ({ ...prev, price_list_item_id: null }));
                            }
                            if (!priceListOpen) setPriceListOpen(true);
                          }}
                          onFocus={() => setPriceListOpen(true)}
                          placeholder="Search or enter custom item name..."
                          className="bg-white pr-10"
                        />
                        {(formData.price_list_item_id || priceListSearch) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, price_list_item_id: null }));
                              setPriceListSearch("");
                              setPriceListOpen(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <div className="max-h-[300px] overflow-y-auto">
                        {priceListItems
                          .filter(item => 
                            !priceListSearch || 
                            item.item?.toLowerCase().includes(priceListSearch.toLowerCase()) ||
                            item.sku?.toLowerCase().includes(priceListSearch.toLowerCase()) ||
                            item.brand?.toLowerCase().includes(priceListSearch.toLowerCase())
                          )
                          .slice(0, 50)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const selectedItem = priceListItems.find(p => p.id === item.id);
                                setFormData(prev => ({ 
                                  ...prev, 
                                  price_list_item_id: item.id,
                                  category: selectedItem?.category || prev.category,
                                  supplier_id: selectedItem?.supplier_id || prev.supplier_id,
                                  supplier_name: selectedItem?.supplier_name || selectedItem?.brand || prev.supplier_name
                                }));
                                setPriceListSearch("");
                                setPriceListOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] transition-colors border-b border-[#E5E7EB] last:border-0"
                            >
                              <div className="font-medium text-sm text-[#111827]">{item.item}</div>
                              <div className="text-xs text-[#6B7280] mt-0.5">
                                {item.sku && `SKU: ${item.sku}`}
                                {item.brand && ` • ${item.brand}`}
                                {item.category && ` • ${item.category}`}
                              </div>
                            </button>
                          ))}
                        {priceListItems.filter(item => 
                          !priceListSearch || 
                          item.item?.toLowerCase().includes(priceListSearch.toLowerCase()) ||
                          item.sku?.toLowerCase().includes(priceListSearch.toLowerCase())
                        ).length === 0 && priceListSearch && (
                          <div className="p-3 text-sm text-[#6B7280] text-center">
                            No matching items. Press Enter to use custom name.
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {priceListSearch && !formData.price_list_item_id && (
                    <p className="text-xs text-[#6B7280]">Custom item: "{priceListSearch}"</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(val) => setFormData({...formData, category: val})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(val) => setFormData({...formData, status: val})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PART_STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>
                          {getPartStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select 
                    value={formData.source_type} 
                    onValueChange={(val) => setFormData({...formData, source_type: val})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>
                          {getSourceTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity Required</Label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.quantity_required || 1}
                    onChange={(e) => setFormData({...formData, quantity_required: parseInt(e.target.value) || 1})}
                    className="bg-white"
                  />
                </div>
              </div>
            </section>



            {/* Supplier Selection for Supplier-type parts */}
            {(formData.source_type === SOURCE_TYPE.SUPPLIER_DELIVERY ||
              formData.source_type === SOURCE_TYPE.SUPPLIER_PICKUP) && (
              <section className="space-y-4">
                <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Supplier Details</h3>
                <p className="text-sm text-[#6B7280]">
                  Select the supplier for this part. You can then add it to a Purchase Order from the Parts list.
                </p>

                {poError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{poError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[#111827] font-medium">Supplier *</Label>
                    <Select
                      value={formData.supplier_id || "none"}
                      onValueChange={(val) => {
                        const supplierId = val === "none" ? "" : val;
                        setFormData(prev => ({ ...prev, supplier_id: supplierId }));
                        setPoError("");
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a supplier</SelectItem>
                        {suppliers.filter(s => s.is_active).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#6B7280] font-normal">Order Date</Label>
                    <Input
                      type="date"
                      value={formData.order_date || ""}
                      onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#6B7280] font-normal">Expected ETA</Label>
                    <Input
                      type="date"
                      value={formData.eta || ""}
                      onChange={(e) => setFormData({...formData, eta: e.target.value})}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#6B7280] font-normal">Tracking URL</Label>
                    <Input
                      type="url"
                      value={formData.tracking_url || ""}
                      onChange={(e) => setFormData({...formData, tracking_url: e.target.value})}
                      placeholder="https://tracking.example.com/..."
                      className="bg-white"
                    />
                  </div>
                </div>
              </section>
            )}

            {(formData.source_type === "Supplier – Deliver to Warehouse" ||
              formData.source_type === "Supplier – Pickup Required") && <hr className="border-[#E5E7EB]" />}

            {/* Quick Movement Actions */}
            {part?.id && (isInLoadingBay || isOnVehicle) && (
              <section className="space-y-4">
                <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Quick Movement</h3>
                <div className="flex flex-wrap gap-3">
                  {isInLoadingBay && (
                    <>
                      <Button
                        type="button"
                        onClick={() => handleMovePart(PART_LOCATION.WAREHOUSE_STORAGE)}
                        disabled={movePartMutation.isPending}
                        variant="outline"
                        className="flex-1 min-w-[140px]"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Move to Storage
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleMovePart(PART_LOCATION.VEHICLE)}
                        disabled={movePartMutation.isPending}
                        variant="outline"
                        className="flex-1 min-w-[140px]"
                      >
                        <Truck className="w-4 h-4 mr-2" />
                        Move to Vehicle
                      </Button>
                    </>
                  )}
                  {isOnVehicle && (
                    <Button
                      type="button"
                      onClick={() => handleMovePart(PART_LOCATION.CLIENT_SITE)}
                      disabled={movePartMutation.isPending}
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Move to Site
                    </Button>
                  )}
                </div>
              </section>
            )}

            {(part?.id && (isInLoadingBay || isOnVehicle)) && <hr className="border-[#E5E7EB]" />}

            {/* Logistics Links */}
            <section className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Logistics Links</h3>
              
              {/* Linked Jobs List */}
              {linkedJobsData.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {linkedJobsData.map(job => (
                    <div key={job.id} className="flex items-center gap-2 bg-[#F3F4F6] px-3 py-1.5 rounded-lg border border-[#E5E7EB]">
                      <LinkIcon className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span className="text-[13px] font-medium text-[#111827]">
                        #{job.job_number} {job.job_type_name || job.job_type}
                      </span>
                      <span className="text-[12px] text-[#6B7280]">
                         • {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d') : 'Unscheduled'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleLogisticsJob(job.id)}
                        className="ml-1 hover:bg-[#E5E7EB] p-0.5 rounded-full"
                      >
                        <X className="w-3.5 h-3.5 text-[#6B7280]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input 
                  placeholder="Search jobs to link (e.g. 'Delivery', 'Pickup')..."
                  className="pl-9 bg-white"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                />
              </div>
              
              {jobSearch && (
                <div className="border border-[#E5E7EB] rounded-lg divide-y divide-[#E5E7EB] max-h-48 overflow-y-auto bg-white shadow-sm max-w-md">
                  {filteredJobs.length === 0 ? (
                    <div className="p-3 text-sm text-[#6B7280] text-center">No jobs found</div>
                  ) : (
                    filteredJobs.map(job => {
                      const isLinked = (formData.linked_logistics_jobs || []).includes(job.id);
                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => toggleLogisticsJob(job.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-[#F9FAFB] text-left transition-colors"
                        >
                          <div>
                            <div className="font-medium text-[14px] text-[#111827]">
                              #{job.job_number} {job.job_type_name || job.job_type}
                            </div>
                            <div className="text-[12px] text-[#6B7280]">
                              {job.customer_name} • {job.scheduled_date || 'Unscheduled'}
                            </div>
                          </div>
                          {isLinked ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Linked</Badge>
                          ) : (
                            <Plus className="w-4 h-4 text-[#6B7280]" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </section>

            <hr className="border-[#E5E7EB]" />

            {/* Notes & Attachments */}
            <section className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Notes & Attachments</h3>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <RichTextEditor
                  value={formData.notes || ""}
                  onChange={(value) => setFormData({...formData, notes: value})}
                  placeholder="Add detailed notes..."
                  className="bg-white"
                />
              </div>

              <div className="space-y-3">
                <Label>Attachments</Label>
                {(formData.attachments || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(formData.attachments || []).map((url, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#E5E7EB] shadow-sm group">
                        <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#6B7280]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 text-[14px] font-medium text-[#111827] hover:underline truncate"
                        >
                          Attachment {index + 1}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 rounded-lg text-[#EF4444]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload').click()}
                    disabled={uploading}
                    className="bg-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Files"}
                  </Button>
                </div>
              </div>
            </section>
          </form>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
          <Button type="button" variant="outline" onClick={onClose} className="bg-white">
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="part-form"
            disabled={isSubmitting}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
          >
            {isSubmitting ? "Saving..." : "Save Part"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}