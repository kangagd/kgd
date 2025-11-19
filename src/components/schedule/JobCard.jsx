import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock } from "lucide-react";
import { Card as ShadCard } from "@/components/ui/card";

const jobTypeColors = {
  "Install": "bg-purple-50 text-purple-700 border-purple-200",
  "Service": "bg-blue-50 text-blue-700 border-blue-200",
  "Repair": "bg-orange-50 text-orange-700 border-orange-200",
  "Maintenance": "bg-green-50 text-green-700 border-green-200",
  "Quote": "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export default function JobCard({ job, onClick, showActions = false }) {
  const jobTypeColor = Object.keys(jobTypeColors).find(key => 
    job.job_type_name?.includes(key)
  ) || "Install";

  return (
    <Card 
      className="card-enhanced card-interactive"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-bold text-[#111827]">#{job.job_number}</span>
          <Badge variant="outline" className={`status-${job.status} capitalize text-xs`}>
            {job.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-[#111827] truncate">
            {job.customer_name}
          </p>

          {job.job_type_name && (
            <Badge variant="outline" className={`${jobTypeColors[jobTypeColor]} font-semibold border-2 text-xs rounded-lg px-2 py-1`}>
              {job.job_type_name}
            </Badge>
          )}

          {job.address && (
            <div className="flex items-start gap-1.5 text-xs text-[#4B5563]">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span className="truncate">{job.address}</span>
            </div>
          )}

          {job.scheduled_time && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#4B5563]" />
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FAE008] text-black">
                {job.scheduled_time}
              </span>
            </div>
          )}

          {showActions && job.customer_phone && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${job.customer_phone}`;
              }}
              className="btn-primary w-full h-10 mt-2 text-sm"
            >
              <Phone className="w-4 h-4 mr-1" />
              Call
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}