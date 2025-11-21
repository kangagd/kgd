import React from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Trash2 } from "lucide-react";

export default function DocumentModal({ documentUrl, documentType, onClose, onDelete }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = `${documentType}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-2xl max-h-[60vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            onClick={handleDownload}
            size="icon"
            className="bg-white hover:bg-gray-100 text-gray-800 shadow-lg"
          >
            <Download className="w-5 h-5" />
          </Button>
          {onDelete && (
            <Button
              onClick={onDelete}
              size="icon"
              className="bg-white hover:bg-red-50 text-red-600 shadow-lg"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
          <Button
            onClick={onClose}
            size="icon"
            className="bg-white hover:bg-gray-100 text-gray-800 shadow-lg"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <iframe
          src={documentUrl}
          className="w-full h-[60vh] rounded-lg bg-white shadow-2xl"
          title={`${documentType} preview`}
        />
      </div>
    </div>
  );
}