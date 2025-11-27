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
import { X, Upload, FileText, Link as LinkIcon, Plus, Search, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import TextField from "../common/TextField";
import { format } from "date-fns";

const CATEGORIES = [
  "Motor", "Door", "Track", "Small Parts", "Control System", "Hardware", "Other"
];

const STATUSES = [
  "Pending", "Ordered", "Back-ordered", "Delivered", "Returned", "Cancelled"
];

const SOURCE_TYPES = [
  "Supplier – Deliver to Warehouse",
  "Supplier – Pickup Required",
  "In Stock (KGD)",
  "Client Supplied"
];

const LOCATIONS = [
  "On Order", "At Supplier", "At Delivery Bay", "In Warehouse Storage", "With Technician", "At Client Site"
];

export default function PartDetailModal({ open, part, onClose, onSave, isSubmitting }) {
  // If part is null (new), initialize with defaults
  const [formData, setFormData] = useState({});
  const [uploading, setUploading] = useState(false);
  const [jobSearch, setJobSearch] = useState("");

  useEffect(() => {
    if (part) {
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
        order_date: part.order_date || (part.id ? "" : new Date().toISOString().split('T')[0])
      };
      setFormData(mappedPart);
    } else {
      setFormData({
        category: "Other",
        status: "Pending",
        source_type: "Supplier – Deliver to Warehouse",
        location: "On Order",
        order_date: new Date().toISOString().split('T')[0],
        linked_logistics_jobs: [],
        attachments: []
      });
    }
  }, [part, open]);

  // Fetch jobs for logistics linking
  const { data: jobs = [] } = useQuery({
    queryKey: ['activeJobs'],
    queryFn: () => base44.entities.Job.filter({ status: { $ne: 'Cancelled' } }),
    enabled: open
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
          <DialogTitle className="text-[22px] font-semibold text-[#111827]">
            {part?.id ? 'Part Details' : 'New Part'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="part-form" onSubmit={handleSubmit} className="p-6 space-y-8">
            
            {/* Part Overview */}
            <section className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Part Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    onValueChange={(val) => {
                      const updates = { status: val };
                      // Auto-set order date if setting to Ordered for first time? 
                      // Prompt says default today on new parts, handled in init.
                      setFormData({...formData, ...updates});
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
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
                      {SOURCE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select 
                    value={formData.location} 
                    onValueChange={(val) => setFormData({...formData, location: val})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <hr className="border-[#E5E7EB]" />

            {/* Supplier & Order Info */}
            <section className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#111827] uppercase tracking-wide">Supplier & Order Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Supplier Name</Label>
                  <Input 
                    value={formData.supplier_name || ""}
                    onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                    placeholder="e.g. Gliderol"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Order Reference</Label>
                  <Input 
                    value={formData.order_reference || ""}
                    onChange={(e) => setFormData({...formData, order_reference: e.target.value})}
                    placeholder="e.g. PO-12345"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input 
                    type="date"
                    value={formData.order_date || ""}
                    onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>ETA</Label>
                  <Input 
                    type="date"
                    value={formData.eta || ""}
                    onChange={(e) => setFormData({...formData, eta: e.target.value})}
                    className="bg-white"
                  />
                </div>
              </div>
            </section>

            <hr className="border-[#E5E7EB]" />

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
                <TextField
                  multiline
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add detailed notes..."
                  className="min-h-[100px] bg-white"
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