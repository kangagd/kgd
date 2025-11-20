import React, { useState, useRef } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, MapPin, User, FileText, CheckCircle2, Package } from "lucide-react";

const statusColors = {
  open: "bg-slate-100 text-slate-700 border-slate-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
  "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600",
  "bg-pink-600", "bg-indigo-600", "bg-red-600", "bg-teal-600",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function JobHoverCard({ job, onJobClick, children }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 shadow-xl border-2 border-blue-200 bg-white z-50"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          setOpen(false);
          onJobClick(job);
        }}
      >
        <CardContent className="p-4 cursor-pointer">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-900 leading-tight mb-0.5">
                {job.customer_name}
              </h3>
              <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-300">
                #{job.job_number}
              </Badge>
            </div>
            <Badge className={`${statusColors[job.status]} font-medium shadow-sm`}>
              {job.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="flex items-start gap-1.5 text-slate-700 text-sm mb-2">
            <MapPin className="w-4 h-4 text-[#fae008] mt-0.5 flex-shrink-0" />
            <span className="font-medium">{job.address}</span>
          </div>

          <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs mb-3">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {job.scheduled_time?.slice(0, 5) || 'No time'}
                {job.expected_duration && ` (${job.expected_duration}h)`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Package className="w-3.5 h-3.5" />
              <span>{job.product || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
              <FileText className="w-3.5 h-3.5" />
              <span>{job.job_type_name || 'N/A'}</span>
            </div>
          </div>

          {(job.assigned_to_name && job.assigned_to_name.length > 0) && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex -space-x-1.5">
                {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 3).map((name, idx) => (
                  <div
                    key={idx}
                    className={`${getAvatarColor(name)} w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm`}
                    title={name}
                  >
                    {getInitials(name)}
                  </div>
                ))}
                {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 3 && (
                  <div className="bg-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-slate-700 text-[10px] font-bold border-2 border-white shadow-sm">
                    +{job.assigned_to_name.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          {job.notes && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-600 line-clamp-2">
                <span className="font-semibold mr-1">Notes:</span>
                {job.notes.replace(/<[^>]*>/g, '')}
              </p>
            </div>
          )}

          {job.outcome && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">
                {job.outcome.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </CardContent>
      </PopoverContent>
    </Popover>
  );
}