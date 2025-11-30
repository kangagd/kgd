import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Briefcase, FolderKanban, MapPin, User, Calendar, Tag, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function PhotoDetailModal({ open, onClose, photo }) {
  const navigate = useNavigate();

  if (!photo) return null;

  const handleDownload = () => {
    window.open(photo.image_url, '_blank');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(photo.image_url);
    toast.success("URL copied to clipboard");
  };

  const handleViewJob = () => {
    if (photo.job_id) {
      navigate(createPageUrl("Jobs") + `?jobId=${photo.job_id}`);
      onClose();
    }
  };

  const handleViewProject = () => {
    if (photo.project_id) {
      navigate(createPageUrl("Projects") + `?projectId=${photo.project_id}`);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Photo Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Large Image */}
          <div className="w-full rounded-lg overflow-hidden bg-[#F8F9FA] border border-[#E5E7EB]">
            <img
              src={photo.image_url}
              alt={photo.notes || 'Photo'}
              className="w-full h-auto"
            />
          </div>

          {/* Info Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {photo.job_number && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Job</div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm font-semibold text-[#111827]">
                      #{photo.job_number}
                    </span>
                  </div>
                </div>
              )}

              {photo.customer_name && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Customer</div>
                  <div className="text-sm font-semibold text-[#111827]">
                    {photo.customer_name}
                  </div>
                </div>
              )}

              {photo.address && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Address</div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-[#111827]">{photo.address}</span>
                  </div>
                </div>
              )}

              {photo.project_name && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Project</div>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm font-semibold text-[#111827]">
                      {photo.project_name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {photo.technician_name && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Technician</div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm text-[#111827]">{photo.technician_name}</span>
                  </div>
                </div>
              )}

              {photo.uploaded_at && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Uploaded</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-sm text-[#111827]">
                      {format(new Date(photo.uploaded_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
              )}

              {photo.product_type && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Product Type</div>
                  <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold">
                    {photo.product_type}
                  </Badge>
                </div>
              )}

              {photo.tags && photo.tags.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {photo.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        className="bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6] border-0 font-medium text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {photo.is_marketing_approved && (
                <div>
                  <Badge className="bg-[#D1FAE5] text-[#065F46] hover:bg-[#D1FAE5] border-0 font-semibold">
                    ✓ Marketing Approved
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {photo.notes && (
            <div>
              <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-1">Notes</div>
              <p className="text-sm text-[#111827]">{photo.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button
              onClick={handleDownload}
              className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold min-w-[120px]"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={handleCopyUrl}
              variant="outline"
              className="flex-1 font-semibold min-w-[120px]"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Copy URL
            </Button>
            {photo.job_id && (
              <Button
                onClick={handleViewJob}
                variant="outline"
                className="flex-1 font-semibold min-w-[120px]"
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Open Job
              </Button>
            )}
            {photo.project_id && (
              <Button
                onClick={handleViewProject}
                variant="outline"
                className="flex-1 font-semibold min-w-[120px]"
              >
                <FolderKanban className="w-4 h-4 mr-2" />
                Open Project
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}