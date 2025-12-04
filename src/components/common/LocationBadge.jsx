import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LOCATION_COLORS = {
  "Main Tool Bag": "bg-blue-100 text-blue-800 border-blue-200",
  "Power Tools": "bg-amber-100 text-amber-800 border-amber-200",
  "Vehicle": "bg-slate-100 text-slate-800 border-slate-200",
  "Consumables": "bg-green-100 text-green-800 border-green-200",
  "Safety Gear": "bg-red-100 text-red-800 border-red-200",
  "Test Equipment": "bg-purple-100 text-purple-800 border-purple-200",
  "Office": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Warehouse": "bg-gray-100 text-gray-800 border-gray-200",
  "Other": "bg-gray-100 text-gray-600 border-gray-200",
  "Uncategorised": "bg-gray-100 text-gray-600 border-gray-200",
};

const DEFAULT_COLOR = "bg-slate-100 text-slate-700 border-slate-200";

export default function LocationBadge({ location, className }) {
  // Try to find exact match
  let colorClass = LOCATION_COLORS[location];

  // If no exact match, check if any key is contained in the location (e.g. "Rear Vehicle" matches "Vehicle")
  if (!colorClass && location) {
    const lowerLoc = location.toLowerCase();
    if (lowerLoc.includes("bag")) colorClass = LOCATION_COLORS["Main Tool Bag"];
    else if (lowerLoc.includes("power")) colorClass = LOCATION_COLORS["Power Tools"];
    else if (lowerLoc.includes("safety")) colorClass = LOCATION_COLORS["Safety Gear"];
    else if (lowerLoc.includes("test")) colorClass = LOCATION_COLORS["Test Equipment"];
    else if (lowerLoc.includes("consumable")) colorClass = LOCATION_COLORS["Consumables"];
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "border", 
        colorClass || DEFAULT_COLOR,
        className
      )}
    >
      {location || "Uncategorised"}
    </Badge>
  );
}