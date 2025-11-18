import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function ScheduleHeader({ 
  currentDate, 
  viewMode, 
  onViewModeChange, 
  onNavigate,
  dateRangeText 
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#111827]">Schedule</h1>
          <p className="text-sm text-[#4B5563] mt-1">{dateRangeText}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewModeChange('day')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${
              viewMode === 'day'
                ? 'bg-[#111827] text-white'
                : 'bg-white text-[#111827] border border-[#E5E7EB] hover:bg-gray-50'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${
              viewMode === 'week'
                ? 'bg-[#111827] text-white'
                : 'bg-white text-[#111827] border border-[#E5E7EB] hover:bg-gray-50'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${
              viewMode === 'month'
                ? 'bg-[#111827] text-white'
                : 'bg-white text-[#111827] border border-[#E5E7EB] hover:bg-gray-50'
            }`}
          >
            Month
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate('prev')}
            className="h-10 w-10 border-[#E5E7EB]"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('today')}
            className="px-4 h-10 font-semibold border-[#E5E7EB]"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate('next')}
            className="h-10 w-10 border-[#E5E7EB]"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}