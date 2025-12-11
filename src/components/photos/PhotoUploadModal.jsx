import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, Search, Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const TAGS = ["Before", "After", "Install", "Repair", "Service", "Maintenance", "Marketing", "Custom", "4D", "Colorbond", "Other"];
const PRODUCT_TYPES = ["Garage Door", "Gate", "Roller Shutter", "Other"];

export default function PhotoUploadModal({ open, onClose, onUploadComplete, preselectedJobId = null }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [tags, setTags] = useState([]);
  const [productType, setProductType] = useState("");
  const [isMarketingApproved, setIsMarketingApproved] = useState(false);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
    enabled: open
  });

  const filteredJobs = jobs.filter(job => 
    !job.deleted_at &&
    (job.job_number?.toString().includes(jobSearch) ||
     job.customer_name?.toLowerCase().includes(jobSearch.toLowerCase()) ||
     job.address?.toLowerCase().includes(jobSearch.toLowerCase()))
  ).slice(0, 10);

  React.useEffect(() => {
    if (preselectedJobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === preselectedJobId);
      if (job) setSelectedJob(job);
    }
  }, [preselectedJobId, jobs]);

  const [duplicates, setDuplicates] = useState({});

  const computeFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleFileChange = async (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
    
    // Check duplicates
    const newDuplicates = { ...duplicates };
    for (const file of newFiles) {
      try {
        const hash = await computeFileHash(file);
        // Check if hash exists in DB
        const existing = await base44.entities.Photo.filter({ file_hash: hash });
        if (existing.length > 0) {
          newDuplicates[file.name] = true;
        }
      } catch (err) {
        console.error("Error computing hash", err);
      }
    }
    setDuplicates(newDuplicates);
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = files[index];
    setFiles(files.filter((_, i) => i !== index));
    if (fileToRemove) {
      const newDuplicates = { ...duplicates };
      delete newDuplicates[fileToRemove.name];
      setDuplicates(newDuplicates);
    }
  };

  const handleAutoTag = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    try {
      const fileToAnalyze = files[0];
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileToAnalyze });

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this photo or video for a field service technician app.
Identify the product type (Garage Door, Gate, Roller Shutter, Other) and suggest relevant tags (Before, After, Install, Repair, Service, Maintenance, Marketing, Other).
Also provide a brief description of what is seen (e.g. "Damaged panel on sectional door" or "Completed installation of roller shutter").
Check if the content is high quality and good for marketing (is_marketing_worthy).

Return ONLY a JSON object.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            product_type: { type: "string", enum: PRODUCT_TYPES },
            tags: { type: "array", items: { type: "string", enum: TAGS } },
            notes: { type: "string" },
            is_marketing_worthy: { type: "boolean" }
          }
        }
      });

      if (response) {
        if (response.product_type && PRODUCT_TYPES.includes(response.product_type)) {
          setProductType(response.product_type);
        }
        if (response.tags && Array.isArray(response.tags)) {
          const validTags = response.tags.filter(t => TAGS.includes(t));
          setTags(prev => [...new Set([...prev, ...validTags])]);
        }
        if (response.notes) {
          setNotes(prev => prev ? `${prev}\n${response.notes}` : response.notes);
        }
        if (response.is_marketing_worthy) {
          setIsMarketingApproved(true);
        }
      }
    } catch (error) {
      console.error("Auto-tagging failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleTag = (tag) => {
    setTags(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const user = await base44.auth.me();
      const uploadPromises = files.map(async (file) => {
        let hash = null;
        try {
          hash = await computeFileHash(file);
        } catch (e) { console.error(e); }

        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // AI Analysis for marketing approval
        let aiAnalysis = null;
        try {
          const analysisResult = await base44.functions.invoke('analyzePhotoForMarketing', {
            image_url: file_url
          });
          aiAnalysis = analysisResult.data;
        } catch (err) {
          console.error('AI analysis failed:', err);
        }

        // Only save to central Photo entity if AI approves for marketing OR user manually approved
        const shouldSaveToCentral = aiAnalysis?.is_marketing_approved || isMarketingApproved;
        
        if (!shouldSaveToCentral) {
          console.log('Content not approved for marketing, skipping save:', file.name);
          return null;
        }

        const photoData = {
          image_url: file_url,
          file_hash: hash,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
          tags: aiAnalysis?.suggested_tags?.length > 0 ? aiAnalysis.suggested_tags : (tags.length > 0 ? tags : undefined),
          product_type: productType || undefined,
          is_marketing_approved: true,
          notes: aiAnalysis?.reason ? `AI: ${aiAnalysis.reason}${notes ? '\n' + notes : ''}` : notes || undefined,
          technician_email: user.email,
          technician_name: user.full_name
        };

        if (selectedJob) {
          photoData.job_id = selectedJob.id;
          photoData.job_number = selectedJob.job_number;
          photoData.customer_id = selectedJob.customer_id;
          photoData.customer_name = selectedJob.customer_name;
          photoData.address = selectedJob.address;
          
          if (selectedJob.project_id) {
            photoData.project_id = selectedJob.project_id;
            photoData.project_name = selectedJob.project_name;
          }
        }

        return base44.entities.Photo.create(photoData);
      });

      const results = await Promise.all(uploadPromises);
      const savedCount = results.filter(r => r !== null).length;
      const rejectedCount = files.length - savedCount;

      // Update project activity if photo is linked to a job with a project
      if (selectedJob?.project_id) {
        try {
          await base44.functions.invoke('updateProjectActivity', { 
            project_id: selectedJob.project_id 
          });
        } catch (err) {
          console.error('Failed to update project activity:', err);
        }
      }

      if (rejectedCount > 0) {
        alert(`${savedCount} item${savedCount !== 1 ? 's' : ''} saved. ${rejectedCount} item${rejectedCount !== 1 ? 's were' : ' was'} rejected (not marketing quality).`);
      }
      
      if (onUploadComplete) onUploadComplete();
      handleClose();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setJobSearch("");
    setSelectedJob(null);
    setTags([]);
    setProductType("");
    setIsMarketingApproved(false);
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Upload Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* File Selection */}
          <div>
            <Label>Select Photos</Label>
            <label className="block mt-1.5">
              <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-8 text-center hover:border-[#FAE008] transition-colors cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-[#6B7280]" />
                <p className="text-sm text-[#4B5563] font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Images (PNG, JPG) or Videos (MP4, MOV)
                </p>
              </div>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className={`flex items-center justify-between p-2 rounded-lg border ${duplicates[file.name] ? 'bg-red-50 border-red-200' : 'bg-[#F8F9FA] border-[#E5E7EB]'}`}>
                    <div className="flex flex-col flex-1 min-w-0 mr-2">
                      <span className={`text-sm truncate ${duplicates[file.name] ? 'text-red-700 font-medium' : 'text-[#111827]'}`}>
                        {file.name}
                      </span>
                      {duplicates[file.name] && (
                        <span className="text-[10px] text-red-600 font-semibold">
                          Duplicate detected
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      className={`h-8 w-8 p-0 ${duplicates[file.name] ? 'text-red-600 hover:bg-red-100' : ''}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoTag}
                  disabled={analyzing}
                  className="w-full mt-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing content...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Auto-fill details with AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Link to Job (Optional) */}
          <div>
            <Label>Link to Job (Optional)</Label>
            {!selectedJob ? (
              <div className="mt-1.5 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    placeholder="Search by job #, customer, or address..."
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {jobSearch && filteredJobs.length > 0 && (
                  <div className="border border-[#E5E7EB] rounded-lg max-h-48 overflow-y-auto">
                    {filteredJobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => {
                          setSelectedJob(job);
                          setJobSearch("");
                        }}
                        className="w-full text-left p-3 hover:bg-[#F8F9FA] transition-colors border-b border-[#E5E7EB] last:border-b-0"
                      >
                        <div className="text-sm font-semibold text-[#111827]">
                          #{job.job_number} - {job.customer_name}
                        </div>
                        <div className="text-xs text-[#6B7280]">{job.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1.5 flex items-center justify-between p-3 bg-[#FAE008]/10 border border-[#FAE008] rounded-lg">
                <div>
                  <div className="text-sm font-semibold text-[#111827]">
                    #{selectedJob.job_number} - {selectedJob.customer_name}
                  </div>
                  <div className="text-xs text-[#6B7280]">{selectedJob.address}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedJob(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <Badge
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`cursor-pointer transition-colors ${
                    tags.includes(tag)
                      ? 'bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]'
                      : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Product Type */}
          <div>
            <Label>Product Type</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select product type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {PRODUCT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Marketing Approved */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="marketing"
              checked={isMarketingApproved}
              onCheckedChange={setIsMarketingApproved}
            />
            <Label htmlFor="marketing" className="cursor-pointer">
              Approve for marketing use
            </Label>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes about these photos..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} Photo${files.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}