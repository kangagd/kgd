import React from "react";
import { Button } from "@/components/ui/button";
import { Timer, ArrowRight, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ActiveCheckInBanner({ checkIns, onClick }) {
  const navigate = useNavigate();
  
  // Handle both single check-in object and array of check-ins
  const checkInArray = Array.isArray(checkIns) ? checkIns : checkIns ? [checkIns] : [];
  
  if (checkInArray.length === 0) return null;
  
  // Single check-in view
  if (checkInArray.length === 1) {
    const checkIn = checkInArray[0];
    const job = checkIn.job;
    
    return (
      <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md relative z-20">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-white/20 p-1.5 rounded-full flex-shrink-0 animate-pulse">
            <Timer className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">Active Check-In</span>
            <span className="text-sm font-bold truncate">
              {job ? (
                <>
                  {job.customer_name} {job.job_number ? `(#${job.job_number})` : ''}
                </>
              ) : (
                "Loading job details..."
              )}
            </span>
          </div>
        </div>
        <Button 
          onClick={() => onClick ? onClick() : navigate(`${createPageUrl("CheckIn")}?jobId=${checkIn.job_id}`)} 
          size="sm" 
          variant="secondary"
          className="ml-4 text-blue-700 bg-white hover:bg-blue-50 border-0 flex-shrink-0 gap-2 h-8 text-xs"
        >
          View Check-In
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    );
  }
  
  // Helper to get initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  // Multiple check-ins view (for admins/managers)
  return (
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md relative z-20">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="bg-white/20 p-1.5 rounded-full flex-shrink-0 animate-pulse">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">
            {checkInArray.length} Active Check-Ins
          </span>
          <div className="flex gap-2 overflow-x-auto">
            {checkInArray.slice(0, 3).map((checkIn, idx) => {
              const jobNumber = checkIn.job?.job_number || '?';
              const initials = getInitials(checkIn.technician_name);
              
              return (
                <span key={checkIn.id} className="text-sm font-bold truncate">
                  #{jobNumber} ({initials})
                  {idx < Math.min(2, checkInArray.length - 1) && ', '}
                </span>
              );
            })}
            {checkInArray.length > 3 && (
              <span className="text-sm font-bold">+{checkInArray.length - 3} more</span>
            )}
          </div>
        </div>
      </div>
      <Button 
        onClick={() => navigate(createPageUrl("Schedule"))} 
        size="sm" 
        variant="secondary"
        className="ml-4 text-blue-700 bg-white hover:bg-blue-50 border-0 flex-shrink-0 gap-2 h-8 text-xs"
      >
        View All
        <ArrowRight className="w-3 h-3" />
      </Button>
    </div>
  );
}