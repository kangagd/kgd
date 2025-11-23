import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  format, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addDays
} from "date-fns";
import { Clock, Phone, Navigation, MapPin, Calendar as CalendarIcon } from "lucide-react";

const statusColors = {
  "Open": "bg-slate-100 text-slate-800",
  "Scheduled": "bg-blue-100 text-blue-800",
  "In Progress": "bg-orange-100 text-orange-800",
  "Completed": "bg-emerald-100 text-emerald-800"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
};

function JobCard({ job, onJobClick }) {
  const extractSuburb = (address) => {
    if (!address) return '';
    const parts = address.split(',').map(s => s.trim());
    return parts[parts.length - 2] || parts[parts.length - 1] || '';
  };

  const suburb = extractSuburb(job.address);

  return (
    <Card 
      className="border border-[#E5E7EB] shadow-sm hover:border-[#FAE008] transition-all cursor-pointer"
      onClick={() => onJobClick(job)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-[#111827] leading-tight mb-1">
                {job.customer_name}
              </h3>
              <p className="text-sm text-[#6B7280] font-medium">{suburb}</p>
            </div>
            {job.scheduled_time && (
              <Badge className="bg-[#FAE008] text-[#111827] border-0 font-bold text-sm px-3 py-1.5 rounded-lg flex-shrink-0">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                {job.scheduled_time?.slice(0, 5)}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {job.status && (
              <Badge className={`${statusColors[job.status] || 'bg-gray-100 text-gray-700'} border-0 font-semibold text-xs px-2.5 py-1 rounded-lg`}>
                {job.status}
              </Badge>
            )}
            {job.product && (
              <Badge className={`${productColors[job.product] || 'bg-gray-100 text-gray-700'} border-0 font-medium text-xs px-2.5 py-1 rounded-lg`}>
                {job.product}
              </Badge>
            )}
            {job.job_type_name && (
              <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-semibold text-xs px-2.5 py-1 rounded-lg">
                {job.job_type_name}
              </Badge>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-[#E5E7EB]">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-2 font-semibold min-h-[44px]"
              onClick={(e) => {
                e.stopPropagation();
                if (job.customer_phone) window.location.href = `tel:${job.customer_phone}`;
              }}
            >
              <Phone className="w-4 h-4 mr-1.5" />
              Call
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-2 font-semibold min-h-[44px]"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank');
              }}
            >
              <Navigation className="w-4 h-4 mr-1.5" />
              Navigate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TechnicianScheduleList({ jobs, currentDate, onJobClick, onDateChange }) {
  const [view, setView] = useState("day");
  const [selectedMonthDate, setSelectedMonthDate] = useState(currentDate);

  const getJobsForDay = (date) => {
    return jobs.filter(job => 
      job.scheduled_date && isSameDay(new Date(job.scheduled_date), date)
    ).sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getMonthDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  // Day View
  const renderDayView = () => {
    const dayJobs = getJobsForDay(currentDate);

    if (dayJobs.length === 0) {
      return (
        <Card className="p-8 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto text-[#6B7280] mb-3" />
          <p className="text-[#6B7280] text-sm mb-4">No jobs scheduled for this day</p>
          <Button
            variant="outline"
            onClick={() => setView("week")}
            className="font-semibold"
          >
            View Week
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {dayJobs.map(job => (
          <JobCard key={job.id} job={job} onJobClick={onJobClick} />
        ))}
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekDays = getWeekDays();

    return (
      <div className="space-y-4">
        {weekDays.map(day => {
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <div key={day.toISOString()}>
              <div 
                className={`flex items-center justify-between p-3 rounded-lg border mb-2 ${
                  isToday ? 'bg-[#FAE008]/10 border-[#FAE008]' : 'bg-white border-[#E5E7EB]'
                }`}
                onClick={() => {
                  onDateChange(day);
                  setView("day");
                }}
              >
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isToday ? 'text-[#111827]' : 'text-[#6B7280]'}`}>
                    {format(day, 'EEE')}
                  </h3>
                  <p className={`text-xl font-bold ${isToday ? 'text-[#111827]' : 'text-[#4B5563]'}`}>
                    {format(day, 'MMM d')}
                  </p>
                </div>
                <Badge className="bg-[#F2F4F7] text-[#344054] border-0 font-bold text-sm px-3 py-1.5 rounded-lg">
                  {dayJobs.length} {dayJobs.length === 1 ? 'Job' : 'Jobs'}
                </Badge>
              </div>

              {dayJobs.length > 0 && (
                <div className="space-y-2 ml-2">
                  {dayJobs.map(job => (
                    <JobCard key={job.id} job={job} onJobClick={onJobClick} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Month View
  const renderMonthView = () => {
    const monthDays = getMonthDays();
    const startDay = monthDays[0].getDay();
    const emptyDays = Array(startDay).fill(null);
    const selectedDayJobs = getJobsForDay(selectedMonthDate);

    return (
      <div className="space-y-4">
        {/* Mini Calendar */}
        <Card className="border border-[#E5E7EB]">
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="text-center text-xs font-bold text-[#6B7280] py-2">
                  {day}
                </div>
              ))}

              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {monthDays.map(day => {
                const dayJobs = getJobsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedMonthDate);
                const hasJobs = dayJobs.length > 0;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedMonthDate(day)}
                    className={`aspect-square rounded-lg p-1 transition-all relative ${
                      isSelected ? 'bg-[#FAE008] ring-2 ring-[#FAE008]' :
                      isToday ? 'bg-[#FAE008]/20' : 
                      'hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <div className={`text-sm font-bold ${
                      isSelected || isToday ? 'text-[#111827]' : 'text-[#4B5563]'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {hasJobs && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                        <div className="w-1 h-1 rounded-full bg-[#111827]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Jobs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#111827]">
              {format(selectedMonthDate, 'EEEE, MMM d')}
            </h3>
            <Badge className="bg-[#F2F4F7] text-[#344054] border-0 font-bold text-sm px-3 py-1 rounded-lg">
              {selectedDayJobs.length} {selectedDayJobs.length === 1 ? 'Job' : 'Jobs'}
            </Badge>
          </div>

          {selectedDayJobs.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-[#6B7280] text-sm">No jobs scheduled</p>
            </Card>
          ) : (
            selectedDayJobs.map(job => (
              <JobCard key={job.id} job={job} onJobClick={onJobClick} />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={setView} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="day" className="flex-1">Day</TabsTrigger>
          <TabsTrigger value="week" className="flex-1">Week</TabsTrigger>
          <TabsTrigger value="month" className="flex-1">Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "day" && renderDayView()}
      {view === "week" && renderWeekView()}
      {view === "month" && renderMonthView()}
    </div>
  );
}