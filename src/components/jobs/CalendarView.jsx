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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-3 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">Schedule</h1>
          <p className="text-sm text-[#4B5563] mt-1">View and manage your schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            title="Previous (←)"
            className="h-10 w-10 p-0 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onDateChange(new Date())}
            title="Today (T)"
            className="h-10 px-4 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-medium"
          >
            Today
          </Button>
          <Button
            variant="outline"
            onClick={handleNext}
            title="Next (→)"
            className="h-10 w-10 p-0 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            id="calendar-search"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
          />
        </div>
      </div>

      {/* View Tabs + Date Display + Book Button + Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Tabs value={view} onValueChange={setView} className="flex-shrink-0">
            <TabsList>
              <TabsTrigger value="day" title="Day view (D)">Day</TabsTrigger>
              <TabsTrigger value="week" title="Week view (W)">Week</TabsTrigger>
              <TabsTrigger value="month" title="Month view (M)">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="text-sm text-[#4B5563] font-medium">
            {view === "month" && format(currentDate, 'MMMM yyyy')}
            {view === "week" && format(currentDate, 'MMM d') + ' – ' + format(addDays(currentDate, 6), 'MMM d, yyyy')}
            {view === "day" && format(currentDate, 'EEEE, MMM d, yyyy')}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleQuickBook()}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition h-10 px-4 text-sm rounded-xl"
            title="New job (N)"
          >
            <Plus className="w-4 h-4 mr-2" />
            Book Job
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-shrink-0 h-10 px-3 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#FAE008] text-[#111827] rounded text-xs font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="border border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-10">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-10">
                  <SelectValue placeholder="All Job Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Types</SelectItem>
                  {uniqueJobTypes.map(jobType => (
                    <SelectItem key={jobType} value={jobType}>{jobType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(statusFilter !== "all" || jobTypeFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("all");
                    setJobTypeFilter("all");
                  }}
                  className="h-10"
                >
                  Clear Filters
                  </Button>
                  )}
                  </div>
                  )}
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      {(searchTerm || statusFilter !== "all" || jobTypeFilter !== "all") && (
        <div className="text-sm text-[#4B5563]">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      )}

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