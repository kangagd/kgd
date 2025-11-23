import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, ExternalLink } from "lucide-react";

const statusColors = {
  Open: "default",
  Scheduled: "primary",
  Completed: "success",
  Cancelled: "error"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-800",
  "Gate": "bg-green-100 text-green-800",
  "Roller Shutter": "bg-purple-100 text-purple-800",
  "Multiple": "bg-orange-100 text-orange-800",
  "Custom Garage Door": "bg-indigo-100 text-indigo-800"
};

const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-pink-500', 'bg-yellow-500', 'bg-indigo-500'
  ];
  const index = name?.charCodeAt(0) % colors.length || 0;
  return colors[index];
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export default function ScheduleJobCard({ job, onClick, onAddressClick, onProjectClick }) {
  return (
    <Card
      onClick={onClick}
      className="p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-[#E5E7EB] rounded-xl bg-white"
    >
      {/* Top Row: Time + Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[#111827]">
          {job.scheduled_time || 'Time TBD'}
        </div>
        <Badge variant={statusColors[job.status] || 'default'}>
          {job.status}
        </Badge>
      </div>

      {/* Middle Section: Job Info */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <Briefcase className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#111827]">
              Job #{job.job_number}
            </div>
            <div className="text-sm text-[#4B5563]">
              {job.customer_name}
            </div>
          </div>
        </div>

        {/* Technicians */}
        {job.assigned_to_name && job.assigned_to_name.length > 0 && (
          <div className="flex items-center gap-2 ml-6">
            <div className="flex -space-x-2">
              {job.assigned_to_name.slice(0, 3).map((name, idx) => (
                <div
                  key={idx}
                  className={`w-6 h-6 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-xs font-semibold text-white border-2 border-white`}
                  title={name}
                >
                  {getInitials(name)}
                </div>
              ))}
            </div>
            <div className="text-xs text-[#6B7280]">
              {job.assigned_to_name.slice(0, 2).join(', ')}
              {job.assigned_to_name.length > 2 && ` +${job.assigned_to_name.length - 2}`}
            </div>
          </div>
        )}

        {/* Job Type + Product Chips */}
        <div className="flex flex-wrap gap-2 ml-6">
          {job.job_type_name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] text-[#4B5563]">
              {job.job_type_name}
            </span>
          )}
          {job.product && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${productColors[job.product] || 'bg-gray-100 text-gray-800'}`}>
              {job.product}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Row: Address + Project */}
      <div className="space-y-2 text-xs text-[#6B7280]">
        {job.address_full && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddressClick(job);
              }}
              className="text-[#2563EB] hover:underline text-left"
            >
              {job.address_full}
            </button>
          </div>
        )}
        {job.project_id && job.project_name && (
          <div className="flex items-start gap-2 ml-5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onProjectClick(job.project_id);
              }}
              className="text-[#2563EB] hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Project: {job.project_name}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}