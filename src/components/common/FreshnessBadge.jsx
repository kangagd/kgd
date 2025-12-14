import React from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

const freshnessConfig = {
  fresh: {
    label: "Fresh",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: Activity
  },
  active: {
    label: "Active",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Activity
  },
  aging: {
    label: "Aging",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: Clock
  },
  stale: {
    label: "Stale",
    color: "bg-slate-200 text-slate-600 border-slate-300",
    icon: Clock
  }
};

export default function FreshnessBadge({ status, lastActionDate, daysSinceAction, className = "" }) {
  if (!status) return null;
  
  const config = freshnessConfig[status];
  if (!config) return null;
  
  const Icon = config.icon;
  
  const tooltipContent = lastActionDate 
    ? `Last activity ${formatDistanceToNow(lastActionDate, { addSuffix: true })}${daysSinceAction !== null ? ` (${daysSinceAction}d ago)` : ''}`
    : "Based on last activity, not age";
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${config.color} text-xs font-medium flex items-center gap-1 ${className}`}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}