import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageOff, Video } from "lucide-react";

export default function PhotoGridItem({ photo, isSelectionMode, isSelected, onToggleSelection, onClick }) {
  const [hasError, setHasError] = useState(false);

  const isVideo = (url) => url && /\.(mp4|webm|ogg|mov|avi)$/i.test(url);

  return (
    <Card
      className={`border shadow-sm transition-all cursor-pointer group overflow-hidden relative ${
        isSelectionMode && isSelected
          ? 'border-[#FAE008] ring-2 ring-[#FAE008]'
          : 'border-[#E5E7EB] hover:border-[#FAE008] hover:shadow-md'
      }`}
      onClick={() => isSelectionMode ? onToggleSelection(photo.id) : onClick(photo)}
    >
      {isSelectionMode && (
        <div className={`absolute top-2 right-2 w-6 h-6 rounded border z-10 flex items-center justify-center ${
          isSelected ? 'bg-[#FAE008] border-[#FAE008]' : 'bg-white border-slate-300'
        }`}>
          {isSelected && <div className="w-3 h-3 bg-[#111827] rounded-sm" />}
        </div>
      )}
      <div className="aspect-square overflow-hidden bg-[#F8F9FA] flex items-center justify-center relative">
        {!hasError ? (
          isVideo(photo.image_url) ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <Video className="w-12 h-12 text-slate-400" />
            </div>
          ) : (
            <img
              src={photo.image_url}
              alt={photo.notes || 'Photo'}
              className={`w-full h-full object-cover transition-transform duration-300 ${!isSelectionMode && 'group-hover:scale-105'}`}
              onError={() => setHasError(true)}
              loading="lazy"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <ImageOff className="w-8 h-8 mb-2" />
            <span className="text-xs">Image not available</span>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="text-sm font-bold text-[#111827] leading-tight truncate">
          {photo.job_number ? `#${photo.job_number} - ${photo.customer_name}` : (photo.customer_name || photo.project_name || 'General Upload')}
        </div>
        <div className="text-xs text-[#6B7280] truncate">
          {photo.address || photo.project_name || `Uploaded by ${photo.technician_name || 'Unknown'}`}
        </div>
        <div className="flex flex-wrap gap-1">
          {photo.tags?.slice(0, 2).map((tag, index) => (
            <Badge
              key={index}
              className="bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6] border-0 font-medium text-[10px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
          {photo.product_type && (
            <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-medium text-[10px] px-1.5 py-0 hover:bg-[#EDE9FE]">
              {photo.product_type}
            </Badge>
          )}
          {photo.is_marketing_approved && (
            <Badge className="bg-[#D1FAE5] text-[#065F46] border-0 font-medium text-[10px] px-1.5 py-0 hover:bg-[#D1FAE5]">
              ✓
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}