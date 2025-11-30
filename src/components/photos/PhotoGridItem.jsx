import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageOff, Video, User, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PhotoGridItem({ photo, isSelectionMode, isSelected, onToggleSelection, onClick }) {
  const [hasError, setHasError] = useState(false);

  const isVideo = (url) => url && /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
  
  // Get display date (taken_at or uploaded_at)
  const displayDate = photo.taken_at || photo.uploaded_at;
  const formattedDate = displayDate ? format(parseISO(displayDate), 'MMM d, yyyy') : '';

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
        
        {/* Type Badge Overlay */}
        {photo.tags && photo.tags.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
             {photo.tags.filter(t => ['Before', 'After', 'Site', 'Product'].includes(t)).slice(0, 2).map(tag => (
                <Badge key={tag} className="bg-black/70 text-white border-0 text-[10px] px-1.5 py-0.5 hover:bg-black/80">
                    {tag}
                </Badge>
             ))}
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex justify-between items-start gap-2">
            <div className="text-sm font-bold text-[#111827] leading-tight truncate flex-1">
            {photo.job_number ? `Job #${photo.job_number}` : 'No Job'}
            </div>
            {formattedDate && (
                <div className="text-[10px] text-[#6B7280] flex items-center gap-1 flex-shrink-0 bg-slate-50 px-1.5 py-0.5 rounded">
                    <Calendar className="w-3 h-3" />
                    {formattedDate}
                </div>
            )}
        </div>
        
        {photo.project_name && (
            <div className="text-xs text-[#4B5563] truncate font-medium">
                {photo.project_name}
            </div>
        )}
        
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            {photo.technician_name && (
                <div className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3" />
                    {photo.technician_name}
                </div>
            )}
        </div>

        <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-slate-100">
          {photo.product_type && (
            <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-medium text-[10px] px-1.5 py-0 hover:bg-[#EDE9FE]">
              {photo.product_type}
            </Badge>
          )}
          {photo.tags?.filter(t => !['Before', 'After', 'Site', 'Product'].includes(t)).slice(0, 2).map((tag, index) => (
            <Badge
              key={index}
              className="bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6] border-0 font-medium text-[10px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}