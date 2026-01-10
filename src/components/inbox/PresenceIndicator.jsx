import React from "react";
import { Eye } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export default function PresenceIndicator({ viewers = [], currentUserEmail }) {
  // Filter out current user and duplicates
  const otherViewers = viewers
    .filter(v => v.user_email !== currentUserEmail)
    .reduce((acc, viewer) => {
      if (!acc.find(v => v.user_email === viewer.user_email)) {
        acc.push(viewer);
      }
      return acc;
    }, []);

  if (otherViewers.length === 0) return null;

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {otherViewers.slice(0, 3).map((viewer, idx) => (
              <div 
                key={viewer.user_email}
                className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-semibold text-white border-2 border-white"
                style={{ marginLeft: idx > 0 ? '-8px' : '0' }}
              >
                {getInitials(viewer.user_name)}
              </div>
            ))}
            {otherViewers.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 ml-1">
                +{otherViewers.length - 3}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs space-y-1">
            <p className="font-medium flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Currently viewing:
            </p>
            {otherViewers.map(viewer => (
              <p key={viewer.user_email}>{viewer.user_name}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}