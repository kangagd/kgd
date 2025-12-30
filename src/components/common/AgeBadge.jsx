import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProjectAge } from "@/components/utils/freshness";

export default function AgeBadge({ entity = null, className = "" }) {
  // Calculate age using the correct function
  const ageInDays = getProjectAge(entity);
  
  if (ageInDays === null) {
    return null;
  }

  const dayLabel = ageInDays === 1 ? 'day' : 'days';
  const label = `${ageInDays} ${dayLabel}`;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200",
        className
      )}
    >
      {label}
    </Badge>
  );
}