import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProjectEffectiveOpenedDate } from "@/components/utils/freshness";

// Helper logic to calculate age in days from a date
const getAgeInDays = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = now - date;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
};

const getAgeBucket = (ageInDays) => {
  if (ageInDays === null || isNaN(ageInDays) || typeof ageInDays !== 'number') return 'unknown';
  if (ageInDays <= 7) return 'new';
  if (ageInDays <= 14) return 'warm';
  if (ageInDays <= 30) return 'aging';
  if (ageInDays <= 60) return 'old';
  return 'stale';
};

const getAgeLabel = (dateValue) => {
  const ageInDays = getAgeInDays(dateValue);
  const bucket = getAgeBucket(ageInDays);
  
  if (bucket === 'unknown') {
    return { ageInDays: null, bucket, label: 'Unknown age' };
  }

  const dayLabel = ageInDays === 1 ? 'day' : 'days';
  const basePart = `${ageInDays} ${dayLabel}`;
  
  let prefix = '';
  switch (bucket) {
    case 'new': prefix = 'New'; break;
    case 'warm': prefix = 'Recent'; break;
    case 'aging': prefix = 'Aging'; break;
    case 'old': prefix = 'Old'; break;
    case 'stale': prefix = 'Stale'; break;
    default: prefix = 'Unknown';
  }

  return {
    ageInDays,
    bucket,
    label: `${prefix} · ${basePart}`
  };
};

export default function AgeBadge({ date, entity = null, prefix = null, className = "" }) {
  // If entity is provided and is a project, use effective opened date
  const effectiveDate = (entity && entity.project_number !== undefined) 
    ? getProjectEffectiveOpenedDate(entity) 
    : date;
  
  const { ageInDays, bucket, label } = getAgeLabel(effectiveDate);

  let colorClasses = "bg-slate-100 text-slate-700 border-slate-200";
  
  switch (bucket) {
    case "new":
      colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-100";
      break;
    case "warm":
      colorClasses = "bg-blue-50 text-blue-700 border-blue-100";
      break;
    case "aging":
      colorClasses = "bg-amber-50 text-amber-700 border-amber-100";
      break;
    case "old":
      colorClasses = "bg-orange-50 text-orange-700 border-orange-100";
      break;
    case "stale":
      colorClasses = "bg-red-50 text-red-700 border-red-100";
      break;
    default:
      colorClasses = "bg-slate-100 text-slate-700 border-slate-200";
  }

  let displayText = label;
  if (prefix && ageInDays !== null) {
    displayText = `${prefix} · ${label}`;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
        colorClasses,
        className
      )}
    >
      {displayText}
    </Badge>
  );
}