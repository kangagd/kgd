import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock } from "lucide-react";

const statusColors = {
  open: { bg: "rgba(37, 99, 235, 0.15)", text: "#2563EB" },
  scheduled: { bg: "#FAE008", text: "#000000" },
  in_progress: { bg: "rgba(14, 165, 233, 0.15)", text: "#0EA5E9" },
  completed: { bg: "rgba(21, 128, 61, 0.15)", text: "#15803D" },
};

const jobTypeColors = {
  "Install": "bg-purple-100 text-purple-800",
  "Service": "bg-blue-100 text-blue-800",
  "Repair": "bg-blue-100 text-blue-800",
  "Maintenance": "bg-green-100 text-green-800",
  "Quote": "bg-orange-100 text-orange-800",
};

export default function JobCard({ job, onClick, showActions = false }) {
  const statusStyle = statusColors[job.status] || statusColors.open;
  const jobTypeColor = Object.keys(jobTypeColors).find(key => 
    job.job_type_name?.includes(key)
  ) || "Install";

  return (
    <Card 
      className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-bold text-[#111827]">#{job.job_number}</span>
          <Badge 
            className="font-semibold text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: statusStyle.bg, 
              color: statusStyle.text,
              border: `1px solid ${statusStyle.text}`
            }}
          >
            {job.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-[#111827] truncate">
            {job.customer_name}
          </p>

          {job.address && (
            <div className="flex items-start gap-1 text-xs text-[#4B5563]">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span className="truncate">{job.address}</span>
            </div>
          )}

          {job.job_type_name && (
            <Badge className={`${jobTypeColors[jobTypeColor]} text-xs font-semibold px-2 py-0.5 rounded-full`}>
              {job.job_type_name}
            </Badge>
          )}

          {job.scheduled_time && (
            <div 
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold mt-2"
              style={{ backgroundColor: '#FFF7B0', color: '#000000' }}
            >
              <Clock className="w-3 h-3" />
              {job.scheduled_time}
            </div>
          )}

          {showActions && job.customer_phone && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${job.customer_phone}`;
              }}
              className="w-full mt-2 h-8 text-xs border-[#E5E7EB]"
            >
              <Phone className="w-3 h-3 mr-1" />
              Call
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}