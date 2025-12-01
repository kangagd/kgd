import React from "react";
import { Badge } from "@/components/ui/badge";
import { getAgeLabel } from "@/components/domain/slaHelpers";
import { cn } from "@/lib/utils";

export default function AgeBadge({ date, prefix = null, className = "" }) {
  const { ageInDays, bucket, label } = getAgeLabel(date);

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
    // label from getAgeLabel already includes a prefix like "New", "Aging" etc.
    // If a custom prefix is provided (e.g. "Created"), we might want to override or prepend.
    // The requirement says: displayText = `${prefix} · ${label}`
    // However, label itself is e.g. "New · 3 days".
    // So "Created · New · 3 days" might be verbose, but following instructions directly.
    
    // Actually, let's look at the requirement logic again:
    // "If prefix is provided... displayText = `${prefix} · ${label}`"
    // But label is "BucketLabel · X days".
    // Let's simplify the label if we are just using the bucket color as the indicator.
    // Actually the helper returns { label: "New · 3 days" }.
    // So the result would be "Created · New · 3 days". 
    // Maybe the user wants to replace the helper's text prefix with their own?
    // "Use getAgeLabel(date) to get... label".
    // "Combine label with optional prefix...".
    
    // If I look at the example in previous prompt: "New · 3 days".
    // If prefix is "Created", maybe we want "Created 3 days ago"? 
    // But the instruction is specific.
    // Let's stick to the instruction.
    
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