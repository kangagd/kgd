import React, { useEffect } from "react";
import { X, Download, Trash2, FileText, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FilePreviewModal({ 
  isOpen,
  onClose, 
  file,
  onDelete,
  canDelete = true
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const isImage = file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || file.type === 'image';
  const isPDF = file.url?.match(/\.pdf$/i) || file.type === 'pdf';
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name || `file-${Date.now()}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div 
          className="relative bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="text-[18px] font-semibold text-[#111827] truncate">
                {file.name || 'File Preview'}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {file.type && (
                  <Badge className="bg-[#F3F4F6] text-[#6B7280] hover:bg-[#F3F4F6] border-0 text-[12px]">
                    {file.type.toUpperCase()}
                  </Badge>
                )}
                {file.jobNumber && (
                  <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-0 text-[12px]">
                    Job #{file.jobNumber}
                  </Badge>
                )}
                {file.projectName && (
                  <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-0 text-[12px]">
                    {file.projectName}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-lg hover:bg-[#F3F4F6] flex-shrink-0"
            >
              <X className="w-5 h-5 text-[#111827]" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            {isImage ? (
              <div className="flex justify-center mb-4">
                <img 
                  src={file.url} 
                  alt={file.name || "Preview"} 
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  style={{ maxHeight: 'calc(90vh - 200px)' }}
                />
              </div>
            ) : isPDF ? (
              <div className="w-full bg-[#F8F9FA] rounded-lg overflow-hidden" style={{ height: 'calc(90vh - 200px)' }}>
                <iframe
                  src={file.url}
                  className="w-full h-full border-0"
                  title={file.name || "PDF Preview"}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
                  <FileText className="w-10 h-10 text-[#6B7280]" />
                </div>
                <p className="text-[16px] font-medium text-[#111827] mb-2">
                  Preview not available
                </p>
                <p className="text-[14px] text-[#6B7280] mb-6">
                  Use Download to view this file
                </p>
              </div>
            )}

            {/* Metadata */}
            {(file.caption || file.address || file.takenAt) && (
              <div className="mt-4 p-4 bg-[#F8F9FA] rounded-lg space-y-2">
                {file.caption && (
                  <p className="text-[14px] text-[#4B5563]">{file.caption}</p>
                )}
                {file.address && (
                  <p className="text-[12px] text-[#6B7280]">
                    <span className="font-medium">Location:</span> {file.address}
                  </p>
                )}
                {file.takenAt && (
                  <p className="text-[12px] text-[#6B7280]">
                    <span className="font-medium">Taken:</span> {new Date(file.takenAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-white border-t border-[#E5E7EB] px-6 py-4 flex gap-3 rounded-b-2xl">
            <Button
              onClick={handleDownload}
              className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-11 rounded-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            {canDelete && onDelete && (
              <Button
                onClick={handleDelete}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold h-11 rounded-lg"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827]">
              Delete File?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-[#6B7280]">
              Are you sure you want to delete this {isImage ? 'photo' : 'file'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}