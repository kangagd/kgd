import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

const statusConfig = {
  "Open": { 
    variant: "secondary", 
    icon: Circle,
    className: "bg-[#F3F4F6] text-[#4B5563]"
  },
  "In Progress": { 
    variant: "primary", 
    icon: Loader2,
    className: "bg-[#FAE008]/20 text-[#92400E]"
  },
  "Completed": { 
    variant: "success", 
    icon: CheckCircle2,
    className: "bg-[#16A34A]/10 text-[#16A34A]"
  },
  "Cancelled": { 
    variant: "secondary", 
    icon: XCircle,
    className: "bg-[#F3F4F6] text-[#6B7280]"
  }
};

const priorityConfig = {
  "Low": { className: "bg-[#F3F4F6] text-[#6B7280]" },
  "Medium": { className: "bg-[#F3F4F6] text-[#4B5563]" },
  "High": { className: "bg-[#DC2626]/10 text-[#DC2626]" }
};

const typeConfig = {
  "Call": { className: "bg-blue-100 text-blue-700" },
  "Email": { className: "bg-purple-100 text-purple-700" },
  "Site Visit": { className: "bg-green-100 text-green-700" },
  "Internal": { className: "bg-gray-100 text-gray-700" },
  "Follow-up": { className: "bg-orange-100 text-orange-700" },
  "Parts / Ordering": { className: "bg-cyan-100 text-cyan-700" },
  "Other": { className: "bg-gray-100 text-gray-600" }
};

export function TaskStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig["Open"];
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.className} gap-1`}>
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority }) {
  const config = priorityConfig[priority] || priorityConfig["Medium"];
  
  return (
    <Badge className={config.className}>
      {priority}
    </Badge>
  );
}

export function TaskTypeBadge({ type }) {
  const config = typeConfig[type] || typeConfig["Other"];
  
  return (
    <Badge className={config.className}>
      {type}
    </Badge>
  );
}