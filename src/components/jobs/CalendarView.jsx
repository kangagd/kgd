import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Search, Filter, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, format } from "date-fns";
import MonthView from "../calendar/MonthView";
import WeekView from "../calendar/WeekView";
import DayView from "../calendar/DayView";
import QuickBookModal from "../calendar/QuickBookModal";

export default function CalendarView({ jobs, onSelectJob, currentDate, onDateChange }) {
  const [view, setView] = useState("week");
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Navigation shortcuts
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        onDateChange(new Date());
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleQuickBook();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setView('day');
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setView('week');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setView('month');
      } else if (e.key === '/' || (e.ctrlKey && e.key === 'f')) {
        e.preventDefault();
        document.getElementById('calendar-search')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, currentDate, onDateChange]);

  const handlePrevious = () => {
    if (view === "month") {
      onDateChange(subMonths(currentDate, 1));
    } else if (view === "week") {
      onDateChange(subWeeks(currentDate, 1));
    } else {
      onDateChange(subDays(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      onDateChange(addMonths(currentDate, 1));
    } else if (view === "week") {
      onDateChange(addWeeks(currentDate, 1));
    } else {
      onDateChange(addDays(currentDate, 1));
    }
  };

  const handleQuickBook = (date = null) => {
    setSelectedDate(date || currentDate);
    setShowQuickBook(true);
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_number?.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesJobType = jobTypeFilter === "all" || job.job_type_name === jobTypeFilter;

    return matchesSearch && matchesStatus && matchesJobType;
  });

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (jobTypeFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            title="Previous (←)"
            className="border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold transition-all rounded-lg h-10 w-10 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg md:text-xl font-bold text-[#111827] min-w-[180px] text-center tracking-tight">
            {view === "month" && format(currentDate, 'MMMM yyyy')}
            {view === "week" && `Week of ${format(currentDate, 'MMM d, yyyy')}`}
            {view === "day" && format(currentDate, 'EEEE, MMM d, yyyy')}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
            title="Today (T)"
            className="border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold transition-all rounded-lg h-10"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            title="Next (→)"
            className="border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold transition-all rounded-lg h-10 w-10 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-10 bg-white border border-[#E5E7EB]">
              <TabsTrigger value="day" title="Day view (D)" className="font-semibold data-[state=active]:bg-[#FAE008] data-[state=active]:text-[#111827]">Day</TabsTrigger>
              <TabsTrigger value="week" title="Week view (W)" className="font-semibold data-[state=active]:bg-[#FAE008] data-[state=active]:text-[#111827]">Week</TabsTrigger>
              <TabsTrigger value="month" title="Month view (M)" className="font-semibold data-[state=active]:bg-[#FAE008] data-[state=active]:text-[#111827]">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={() => handleQuickBook()}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-md hover:shadow-lg transition-all rounded-lg h-10"
            size="sm"
            title="New job (N)"
          >
            <Plus className="w-4 h-4 mr-2" />
            Book Job
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <Input
              id="calendar-search"
              placeholder="Search jobs... (press / to focus)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`border border-[#E5E7EB] hover:bg-[#F3F4F6] font-semibold transition-all h-12 rounded-lg ${activeFiltersCount > 0 ? "border-[#FAE008] bg-[#FAE008]/10" : ""}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge className="ml-2 bg-[#FAE008] text-[#111827] px-2 py-0.5 text-xs font-bold">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {showFilters && (
          <Card className="rounded-xl border border-[#E5E7EB]">
            <CardContent className="p-5">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-[#111827] mb-2 block tracking-tight uppercase">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-[#111827] mb-2 block tracking-tight uppercase">Job Type</label>
                  <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                    <SelectTrigger className="h-11 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20">
                      <SelectValue placeholder="All job types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Job Types</SelectItem>
                      {uniqueJobTypes.map(jobType => (
                        <SelectItem key={jobType} value={jobType}>{jobType}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(statusFilter !== "all" || jobTypeFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter("all");
                      setJobTypeFilter("all");
                    }}
                    className="self-end font-semibold h-11"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {(searchTerm || statusFilter !== "all" || jobTypeFilter !== "all") && (
          <div className="text-sm text-[#4B5563] font-semibold">
            Showing {filteredJobs.length} of {jobs.length} jobs
          </div>
        )}
      </div>

      {view === "month" && (
        <MonthView
          jobs={filteredJobs}
          currentDate={currentDate}
          onJobClick={onSelectJob}
          onQuickBook={handleQuickBook}
        />
      )}

      {view === "week" && (
        <WeekView
          jobs={filteredJobs}
          currentDate={currentDate}
          onJobClick={onSelectJob}
          onQuickBook={handleQuickBook}
        />
      )}

      {view === "day" && (
        <DayView
          jobs={filteredJobs}
          currentDate={currentDate}
          onJobClick={onSelectJob}
          onQuickBook={handleQuickBook}
        />
      )}

      <QuickBookModal
        open={showQuickBook}
        onClose={() => setShowQuickBook(false)}
        selectedDate={selectedDate}
      />
    </div>
  );
}