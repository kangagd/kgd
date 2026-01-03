import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, CheckCircle2 } from "lucide-react";

export default function ReplyStatusBadge({ project }) {
  if (!project.last_customer_message_at && !project.last_internal_message_at) {
    return null;
  }

  const customerTime = project.last_customer_message_at ? new Date(project.last_customer_message_at) : null;
  const internalTime = project.last_internal_message_at ? new Date(project.last_internal_message_at) : null;

  // Determine who needs to reply
  let status = null;
  if (!customerTime && internalTime) {
    status = 'awaiting_customer';
  } else if (!internalTime && customerTime) {
    status = 'awaiting_us';
  } else if (customerTime && internalTime) {
    status = customerTime > internalTime ? 'awaiting_us' : 'awaiting_customer';
  }

  if (!status) return null;

  const config = {
    awaiting_us: {
      label: 'Awaiting Our Reply',
      icon: Clock,
      className: 'bg-orange-100 text-orange-700 border-orange-200'
    },
    awaiting_customer: {
      label: 'Awaiting Customer',
      icon: CheckCircle2,
      className: 'bg-blue-100 text-blue-700 border-blue-200'
    }
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={`text-[11px] ${className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}