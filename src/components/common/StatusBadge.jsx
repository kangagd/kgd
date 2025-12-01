import React from "react";
import { cn } from "@/lib/utils";
import { JOB_STATUS } from "@/components/domain/jobConfig";

// Unified badge variant mappings
const BADGE_VARIANTS = {
  // Customer Types
  customerType: {
    "Owner": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Builder": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Real Estate - Tenant": "bg-green-100 text-green-700 hover:bg-green-200",
    "Strata - Owner": "bg-amber-100 text-amber-700 hover:bg-amber-200",
  },
  
  // Project Statuses
  projectStatus: {
    "Lead": "bg-slate-100 text-slate-700 hover:bg-slate-200",
    "Initial Site Visit": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Quote Sent": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Quote Approved": "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
    "Final Measure": "bg-cyan-100 text-cyan-700 hover:bg-cyan-200",
    "Parts Ordered": "bg-amber-100 text-amber-700 hover:bg-amber-200",
    "Scheduled": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Completed": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  },
  
  // Project Types
  projectType: {
    "Garage Door Install": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Gate Install": "bg-green-100 text-green-700 hover:bg-green-200",
    "Roller Shutter Install": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Multiple": "bg-pink-100 text-pink-700 hover:bg-pink-200",
    "Motor/Accessory": "bg-cyan-100 text-cyan-700 hover:bg-cyan-200",
    "Repair": "bg-orange-100 text-orange-700 hover:bg-orange-200",
    "Maintenance": "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
  },
  
  // Job Types - fallback colors when entity color not available
  jobType: {
    "Initial Site Visit": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Initial Site Measure": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Investigation / Diagnostics": "bg-slate-100 text-slate-700 hover:bg-slate-200",
    "Repair": "bg-orange-100 text-orange-700 hover:bg-orange-200",
    "Service / Maintenance": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Service": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Maintenance": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Final Measure": "bg-cyan-100 text-cyan-700 hover:bg-cyan-200",
    "Installation": "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
    "Install": "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
    "Motor Installation": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Remote Programming": "bg-pink-100 text-pink-700 hover:bg-pink-200",
    "Accessory Installation": "bg-amber-100 text-amber-700 hover:bg-amber-200",
    "Call Back": "bg-rose-100 text-rose-700 hover:bg-rose-200",
    "Callback": "bg-rose-100 text-rose-700 hover:bg-rose-200",
    "Warranty": "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
    "Quote Follow-up": "bg-violet-100 text-violet-700 hover:bg-violet-200",
    "Inspection": "bg-teal-100 text-teal-700 hover:bg-teal-200",
  },
  
  // Job Statuses
  jobStatus: {
    "Open": "bg-slate-100 text-slate-700 hover:bg-slate-200",
    "Scheduled": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Completed": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Cancelled": "bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
  
  // Payment/Financial Statuses
  paymentStatus: {
    "Pending": "bg-amber-100 text-amber-700 hover:bg-amber-200",
    "Paid": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Overdue": "bg-red-100 text-red-700 hover:bg-red-200",
  },
  
  // Email Priority
  emailPriority: {
    "High": "bg-red-100 text-red-700 hover:bg-red-200",
    "Normal": "bg-slate-100 text-slate-700 hover:bg-slate-200",
    "Low": "bg-green-100 text-green-700 hover:bg-green-200",
  },
  
  // Email Status
  emailStatus: {
    "Open": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "In Progress": "bg-amber-100 text-amber-700 hover:bg-amber-200",
    "Closed": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Archived": "bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
  
  // Generic Status
  status: {
    "active": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "inactive": "bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
  
  // Parts Status
  partsStatus: {
    "Pending": "bg-slate-100 text-slate-700 hover:bg-slate-200",
    "Ordered": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Back-ordered": "bg-amber-100 text-amber-700 hover:bg-amber-200",
    "Delivered": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Cancelled": "bg-red-100 text-red-700 hover:bg-red-200",
  },
  
  // Organisation Types
  organisationType: {
    "Strata": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Builder": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Real Estate": "bg-green-100 text-green-700 hover:bg-green-200",
    "Supplier": "bg-amber-100 text-amber-700 hover:bg-amber-200",
  },
  
  // Product Types
  productType: {
    "Garage Door": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Gate": "bg-green-100 text-green-700 hover:bg-green-200",
    "Roller Shutter": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Multiple": "bg-pink-100 text-pink-700 hover:bg-pink-200",
    "Custom Garage Door": "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
    "Other": "bg-slate-100 text-slate-700 hover:bg-slate-200",
  },
  
  // Quote Statuses
  quoteStatus: {
    "Draft": "bg-slate-100 text-slate-700 hover:bg-slate-200",
    "Sent": "bg-blue-100 text-blue-700 hover:bg-blue-200",
    "Viewed": "bg-purple-100 text-purple-700 hover:bg-purple-200",
    "Accepted": "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    "Declined": "bg-red-100 text-red-700 hover:bg-red-200",
    "Expired": "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
};

// Global base badge styles (applied to all variants)
const baseBadgeStyles = "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium transition-colors border-0 shadow-none";

// Capitalize first letter of each word
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export function StatusBadge({ type, value, className, ...props }) {
  if (!value) return null;
  
  const variantMap = BADGE_VARIANTS[type] || {};
  const variantClass = variantMap[value] || "bg-slate-100 text-slate-700 hover:bg-slate-200";
  
  return (
    <span
      className={cn(baseBadgeStyles, variantClass, className)}
      {...props}
    >
      {capitalizeWords(value)}
    </span>
  );
}

// Convenience exports for common badge types
export function CustomerTypeBadge({ value, ...props }) {
  return <StatusBadge type="customerType" value={value} {...props} />;
}

export function ProjectStatusBadge({ value, ...props }) {
  return <StatusBadge type="projectStatus" value={value} {...props} />;
}

export function ProjectTypeBadge({ value, ...props }) {
  return <StatusBadge type="projectType" value={value} {...props} />;
}

export function JobTypeBadge({ value, ...props }) {
  return <StatusBadge type="jobType" value={value} {...props} />;
}

export function JobStatusBadge({ value, ...props }) {
  return <StatusBadge type="jobStatus" value={value} {...props} />;
}

export function PaymentStatusBadge({ value, ...props }) {
  return <StatusBadge type="paymentStatus" value={value} {...props} />;
}

export function EmailPriorityBadge({ value, ...props }) {
  return <StatusBadge type="emailPriority" value={value} {...props} />;
}

export function EmailStatusBadge({ value, ...props }) {
  return <StatusBadge type="emailStatus" value={value} {...props} />;
}

export function PartsStatusBadge({ value, ...props }) {
  return <StatusBadge type="partsStatus" value={value} {...props} />;
}

export function OrganisationTypeBadge({ value, ...props }) {
  return <StatusBadge type="organisationType" value={value} {...props} />;
}

export function ProductTypeBadge({ value, ...props }) {
  return <StatusBadge type="productType" value={value} {...props} />;
}

export function QuoteStatusBadge({ value, ...props }) {
  return <StatusBadge type="quoteStatus" value={value} {...props} />;
}

export default StatusBadge;