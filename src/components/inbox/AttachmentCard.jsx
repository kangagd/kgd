import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Save, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, Loader2, Check } from "lucide-react";
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

const isImageFile = (mimeType, filename) => {
  const name = filename?.toLowerCase() || '';
  const type = mimeType?.toLowerCase() || '';
  return type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/.test(name);
};

export default function AttachmentCard({ 
  attachment, 
  linkedJobId, 
  linkedProjectId, 
  threadSubject,
  onSaveComplete,
  gmailMessageId, // Pass from parent if needed
  autoSave = true // Auto-save to project when rendered
}) {
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(attachment.url || null);
  const [saved, setSaved] = useState(false);
  const autoSaveAttempted = useRef(false);
  
  // Use gmail_message_id from attachment or from prop
  // Prioritize attachment's own gmail_message_id, then fall back to prop
  const effectiveGmailMessageId = attachment.gmail_message_id || gmailMessageId;
  const effectiveAttachmentId = attachment.attachment_id;
  
  // Debug logging
  useEffect(() => {
    if (!effectiveGmailMessageId || !effectiveAttachmentId) {
      console.warn('AttachmentCard missing IDs:', {
        filename: attachment.filename,
        attachment_gmail_message_id: attachment.gmail_message_id,
        prop_gmail_message_id: gmailMessageId,
        attachment_id: attachment.attachment_id
      });
    }
  }, [attachment, gmailMessageId, effectiveGmailMessageId, effectiveAttachmentId]);

  // Auto-save attachment to project when component mounts
  useEffect(() => {
    if (!autoSave || !linkedProjectId || autoSaveAttempted.current) return;
    if (!effectiveGmailMessageId || !effectiveAttachmentId) return;
    
    const autoSaveAttachment = async () => {
      autoSaveAttempted.current = true;
      
      try {
        // Fetch project to check if already saved
        const project = await base44.entities.Project.get(linkedProjectId);
        const existingImages = project.image_urls || [];
        const existingDocs = project.other_documents || [];
        
        // Check if this attachment filename is already in the project
        const allUrls = [...existingImages, ...existingDocs];
        const alreadySaved = allUrls.some(url => url.includes(attachment.filename));
        
        if (alreadySaved) {
          setSaved(true);
          return;
        }
        
        // Resolve the URL
        let urlToSave = resolvedUrl;
        if (!urlToSave) {
          const result = await base44.functions.invoke('getGmailAttachment', {
            gmail_message_id: effectiveGmailMessageId,
            attachment_id: effectiveAttachmentId,
            filename: attachment.filename,
            mime_type: attachment.mime_type
          });
          if (result.data?.url) {
            urlToSave = result.data.url;
            setResolvedUrl(urlToSave);
          }
        }
        
        if (!urlToSave) return;
        
        // Categorize and save
        const isImage = isImageFile(attachment.mime_type, attachment.filename);
        
        if (isImage) {
          await base44.entities.Project.update(linkedProjectId, {
            image_urls: [...existingImages, urlToSave]
          });
        } else {
          await base44.entities.Project.update(linkedProjectId, {
            other_documents: [...existingDocs, urlToSave]
          });
        }
        
        setSaved(true);
        console.log(`Auto-saved ${attachment.filename} to project as ${isImage ? 'image' : 'document'}`);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };
    
    autoSaveAttachment();
  }, [linkedProjectId, autoSave, effectiveGmailMessageId, effectiveAttachmentId, attachment, resolvedUrl]);

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
      // First resolve the URL if needed
      let urlToSave = resolvedUrl;
      if (!urlToSave && attachment.attachment_id && effectiveGmailMessageId) {
        const result = await base44.functions.invoke('getGmailAttachment', {
          gmail_message_id: effectiveGmailMessageId,
          attachment_id: attachment.attachment_id,
          filename: attachment.filename,
          mime_type: attachment.mime_type
        });
        if (result.data?.url) {
          urlToSave = result.data.url;
          setResolvedUrl(urlToSave);
        }
      }
      
      if (!urlToSave) {
        toast.error('Attachment not available - missing Gmail message ID or attachment ID');
        console.error('Missing attachment data:', { attachment, effectiveGmailMessageId });
        return;
      }

      if (linkedJobId) {
        const job = await base44.entities.Job.get(linkedJobId);
        const updatedImageUrls = [...(job.image_urls || []), urlToSave];
        await base44.entities.Job.update(linkedJobId, { image_urls: updatedImageUrls });
        toast.success('Attachment saved to job');
      } else if (linkedProjectId) {
        const project = await base44.entities.Project.get(linkedProjectId);
        const updatedImageUrls = [...(project.image_urls || []), urlToSave];
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
            saved ? (
              <div className="h-8 w-8 flex items-center justify-center text-green-600" title="Saved to project">
                <Check className="w-4 h-4" />
              </div>
            ) : (
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
            )
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={downloading}
            onClick={async () => {
              // If we already have a URL, use it
              if (resolvedUrl) {
                window.open(resolvedUrl, '_blank');
                return;
              }
              
              // If we have attachment_id and gmail_message_id, fetch from Gmail
              if (attachment.attachment_id && effectiveGmailMessageId) {
                setDownloading(true);
                try {
                  const result = await base44.functions.invoke('getGmailAttachment', {
                    gmail_message_id: effectiveGmailMessageId,
                    attachment_id: attachment.attachment_id,
                    filename: attachment.filename,
                    mime_type: attachment.mime_type
                  });
                  if (result.data?.url) {
                    setResolvedUrl(result.data.url);
                    window.open(result.data.url, '_blank');
                  } else {
                    toast.error('Failed to download attachment');
                  }
                } catch (err) {
                  console.error('Download error:', err);
                  toast.error('Failed to download attachment');
                } finally {
                  setDownloading(false);
                }
              } else {
                toast.error('Attachment not available - missing Gmail message ID or attachment ID');
                console.error('Missing attachment data:', { attachment, effectiveGmailMessageId });
              }
            }}
            className="h-8 w-8 p-0"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}