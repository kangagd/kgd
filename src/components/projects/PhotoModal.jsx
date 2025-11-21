import React from "react";
import { X, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PhotoModal({ imageUrl, onClose, onDelete }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `photo-${Date.now()}.jpg`;
    link.target = '_blank';
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
        className="relative max-w-3xl max-h-[80vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <Button
            onClick={handleDownload}
            size="icon"
            className="bg-white/90 hover:bg-white text-[#111827] h-10 w-10 rounded-lg shadow-lg"
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button
            onClick={onDelete}
            size="icon"
            className="bg-white/90 hover:bg-white text-red-600 h-10 w-10 rounded-lg shadow-lg"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
          <Button
            onClick={onClose}
            size="icon"
            className="bg-white/90 hover:bg-white text-[#111827] h-10 w-10 rounded-lg shadow-lg"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <img 
          src={imageUrl} 
          alt="Expanded view" 
          className="w-full h-full object-contain rounded-lg"
        />
      </div>
    </div>
  );
}