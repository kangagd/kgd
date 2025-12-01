import React from "react";
import { Button } from "@/components/ui/button";
import { Timer, ArrowRight } from "lucide-react";

export default function ActiveCheckInBanner({ job, onClick }) {
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
        onClick={onClick} 
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