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
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div 
          className="relative max-w-7xl w-full max-h-[95vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Corner Actions */}
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <Button
              onClick={handleDownload}
              size="icon"
              className="w-10 h-10 bg-white/90 hover:bg-white text-[#111827] rounded-full shadow-lg backdrop-blur-sm"
            >
              <Download className="w-5 h-5" />
            </Button>
            {canDelete && onDelete && (
              <Button
                onClick={handleDelete}
                size="icon"
                className="w-10 h-10 bg-white/90 hover:bg-white text-red-600 rounded-full shadow-lg backdrop-blur-sm"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button
              onClick={onClose}
              size="icon"
              className="w-10 h-10 bg-white/90 hover:bg-white text-[#111827] rounded-full shadow-lg backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="w-full h-full flex items-center justify-center">
            {isImage ? (
              <img 
                src={file.url} 
                alt={file.name || "Preview"} 
                className="max-w-full max-h-[95vh] object-contain"
              />
            ) : isPDF ? (
              <div className="w-full h-[95vh] bg-white rounded-lg overflow-hidden shadow-2xl">
                <iframe
                  src={file.url}
                  className="w-full h-full border-0"
                  title={file.name || "PDF Preview"}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-white/10 backdrop-blur-sm rounded-2xl px-12">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <p className="text-[16px] font-medium text-white mb-2">
                  Preview not available
                </p>
                <p className="text-[14px] text-white/80 mb-6">
                  Use Download to view this file
                </p>
              </div>
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