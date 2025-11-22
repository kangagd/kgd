import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Save, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, Sparkles, Loader2, FolderOpen, Link as LinkIcon } from "lucide-react";
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
  threadCategory,
  onSaveComplete 
}) {
  const [saving, setSaving] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getDocumentType = (filename, mimeType) => {
    const name = filename?.toLowerCase() || '';
    const type = mimeType?.toLowerCase() || '';
    
    // Invoices & Financial
    if (/invoice|bill|receipt|payment/.test(name)) return 'invoice';
    if (/quote|estimate|proposal/.test(name)) return 'quote';
    if (/contract|agreement/.test(name)) return 'contract';
    
    // Technical
    if (/spec|specification|drawing|blueprint|plan/.test(name)) return 'technical';
    if (/measure|measurement/.test(name)) return 'measurement';
    
    // Images
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif)$/.test(name)) {
      if (/photo|pic|img/.test(name)) return 'photo';
      return 'image';
    }
    
    return 'document';
  };

  // AI-powered suggestion
  useEffect(() => {
    const generateSuggestion = async () => {
      if (!attachment.filename) return;
      
      const docType = getDocumentType(attachment.filename, attachment.mime_type);
      
      // Quick rules-based suggestions
      if (docType === 'invoice' || docType === 'quote') {
        if (linkedProjectId) {
          setSuggestion({
            action: 'save_to_project',
            reason: `This looks like ${docType === 'invoice' ? 'an invoice' : 'a quote'} - save to linked project`,
            icon: FolderOpen,
            color: 'text-blue-600'
          });
        }
        return;
      }
      
      if (docType === 'photo' || docType === 'image') {
        if (linkedJobId) {
          setSuggestion({
            action: 'save_to_job',
            reason: 'Save photo to job documentation',
            icon: FolderOpen,
            color: 'text-green-600'
          });
        } else if (linkedProjectId) {
          setSuggestion({
            action: 'save_to_project',
            reason: 'Save photo to project gallery',
            icon: FolderOpen,
            color: 'text-green-600'
          });
        }
        return;
      }
      
      // For complex cases, use AI
      if (!linkedJobId && !linkedProjectId && threadCategory) {
        setLoadingSuggestion(true);
        try {
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this email attachment and suggest an action:
            
Filename: ${attachment.filename}
Email Subject: ${threadSubject}
Email Category: ${threadCategory}

Based on the filename and context, suggest ONE action:
- "create_project" if it looks like a new project inquiry with specs/drawings
- "create_job" if it looks like a service request or job-related document
- "save_for_billing" if it's an invoice/payment document
- "no_action" if it's just informational

Return JSON with: {"action": "...", "reason": "brief explanation"}`,
            response_json_schema: {
              type: "object",
              properties: {
                action: { type: "string" },
                reason: { type: "string" }
              }
            }
          });
          
          if (result.action !== 'no_action') {
            setSuggestion({
              action: result.action,
              reason: result.reason,
              icon: Sparkles,
              color: 'text-purple-600'
            });
          }
        } catch (error) {
          console.error('Failed to generate AI suggestion:', error);
        } finally {
          setLoadingSuggestion(false);
        }
      }
    };
    
    generateSuggestion();
  }, [attachment.filename, linkedJobId, linkedProjectId, threadCategory, threadSubject]);

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

      {/* AI Suggestion - Compact */}
      {loadingSuggestion && (
        <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Analyzing...</span>
        </div>
      )}
      
      {suggestion && !loadingSuggestion && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={saving || (!linkedJobId && !linkedProjectId)}
          className="h-7 w-full justify-start gap-1.5 px-2 text-[10px] bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border border-purple-200/50"
          title={suggestion.reason}
        >
          <Sparkles className="w-3 h-3 text-purple-600" />
          <span className="truncate">{suggestion.reason}</span>
        </Button>
      )}
    </div>
  );
}