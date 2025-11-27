import React, { useEffect, useState } from "react";
import { X, Download, Trash2, FileText, File, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(file?.index || 0);

  // Update currentIndex when file changes
  useEffect(() => {
    if (file?.index !== undefined) {
      setCurrentIndex(file.index);
    }
  }, [file?.index]);

  const allImages = file?.allImages || [];
  const hasMultipleImages = allImages.length > 1;
  const currentUrl = hasMultipleImages ? allImages[currentIndex] : file?.url;

  const goToPrevious = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const goToNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
      } else if (e.key === 'ArrowRight' && hasMultipleImages) {
        setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, hasMultipleImages, allImages.length]);

  if (!isOpen || !file) return null;

  const fileUrl = typeof currentUrl === 'string' ? currentUrl : '';
  const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) || file.type === 'image';
  const isVideo = fileUrl.match(/\.(mp4|mov|webm|avi|mkv)$/i) || file.type === 'video';
  const isPDF = fileUrl.match(/\.pdf$/i) || file.type === 'pdf';
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = file.name || `file-${Date.now()}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
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
              onClick={handleOpenInNewTab}
              size="icon"
              className="w-10 h-10 bg-white/90 hover:bg-white text-[#111827] rounded-full shadow-lg backdrop-blur-sm"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </Button>
            <Button
              onClick={handleDownload}
              size="icon"
              className="w-10 h-10 bg-white/90 hover:bg-white text-[#111827] rounded-full shadow-lg backdrop-blur-sm"
              title="Download"
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

          {/* Navigation Arrows */}
          {hasMultipleImages && (isImage || isVideo) && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white text-[#111827] rounded-full shadow-lg backdrop-blur-sm flex items-center justify-center z-20 transition-all hover:scale-110"
                title="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white text-[#111827] rounded-full shadow-lg backdrop-blur-sm flex items-center justify-center z-20 transition-all hover:scale-110"
                title="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Image/Video Counter */}
          {hasMultipleImages && (isImage || isVideo) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm z-20">
              {currentIndex + 1} / {allImages.length}
            </div>
          )}

          {/* Content */}
          <div className="w-full h-full flex items-center justify-center">
            {isImage ? (
              <img 
                src={currentUrl} 
                alt={file.name || "Preview"} 
                className="max-w-full max-h-[95vh] object-contain"
              />
            ) : isVideo ? (
              <video
                src={currentUrl}
                controls
                autoPlay
                className="max-w-full max-h-[95vh] object-contain rounded-lg"
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