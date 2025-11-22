import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Save, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const getAttachmentIcon = (mimeType, filename) => {
  if (!mimeType && !filename) return FileText;
  
  const name = filename?.toLowerCase() || '';
  const type = mimeType?.toLowerCase() || '';
  
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg)$/.test(name)) return ImageIcon;
  if (type.includes('spreadsheet') || /\.(xlsx?|csv)$/.test(name)) return FileSpreadsheet;
  if (type.includes('zip') || type.includes('compressed') || /\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  
  return FileText;
};

export default function AttachmentCard({ 
  attachment, 
  linkedJobId, 
  linkedProjectId, 
  threadSubject,
  onSaveComplete 
}) {
  const [saving, setSaving] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (linkedJobId) {
        const job = await base44.entities.Job.get(linkedJobId);
        const updatedImageUrls = [...(job.image_urls || []), attachment.url];
        await base44.entities.Job.update(linkedJobId, { image_urls: updatedImageUrls });
        toast.success('Attachment saved to job');
      } else if (linkedProjectId) {
        const project = await base44.entities.Project.get(linkedProjectId);
        const updatedImageUrls = [...(project.image_urls || []), attachment.url];
        await base44.entities.Project.update(linkedProjectId, { image_urls: updatedImageUrls });
        toast.success('Attachment saved to project');
      }
      if (onSaveComplete) onSaveComplete();
    } catch (error) {
      toast.error('Failed to save attachment');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const AttachmentIcon = getAttachmentIcon(attachment.mime_type, attachment.filename);

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-sm transition-all">
      {/* File Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
            <AttachmentIcon className="w-4 h-4 text-[#6B7280]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[#111827] font-medium truncate">
              {attachment.filename}
            </p>
            {attachment.size > 0 && (
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                {formatFileSize(attachment.size)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {(linkedJobId || linkedProjectId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              title={`Save to ${linkedJobId ? 'Job' : 'Project'}`}
              className="h-8 w-8 p-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          )}
          {attachment.url && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0"
            >
              <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}