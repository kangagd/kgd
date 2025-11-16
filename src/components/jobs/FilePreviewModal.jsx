import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FilePreviewModal({ open, onClose, fileUrl, fileName }) {
  const isImage = fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  const isPDF = fileUrl && /\.pdf$/i.test(fileUrl);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>File Preview</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {isImage ? (
            <img src={fileUrl} alt={fileName || "Preview"} className="w-full h-auto rounded-lg" />
          ) : isPDF ? (
            <iframe src={fileUrl} className="w-full h-[70vh] rounded-lg border" />
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 mb-4">Preview not available for this file type</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}