import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addMonths, subMonths, addWeeks, subWeeks, format } from "date-fns";
import MonthView from "../calendar/MonthView";
import WeekView from "../calendar/WeekView";
import DayView from "../calendar/DayView";
import QuickBookModal from "../calendar/QuickBookModal";

export default function CalendarView({ jobs, onSelectJob, currentDate, onDateChange }) {
  const [view, setView] = useState("week");
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const handlePrevious = () => {
    if (view === "month") {
      onDateChange(subMonths(currentDate, 1));
    } else if (view === "week") {
      onDateChange(subWeeks(currentDate, 1));
    } else {
      onDateChange(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      onDateChange(addMonths(currentDate, 1));
    } else if (view === "week") {
      onDateChange(addWeeks(currentDate, 1));
    } else {
      onDateChange(addWeeks(currentDate, 1));
    }
  };

  const handleQuickBook = (date = null) => {
    setSelectedDate(date || currentDate);
    setShowQuickBook(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 min-w-[140px] text-center">
            {view === "month" && format(currentDate, 'MMMM yyyy')}
            {view === "week" && `Week of ${format(currentDate, 'MMM d, yyyy')}`}
            {view === "day" && format(currentDate, 'EEEE, MMM d, yyyy')}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={() => handleQuickBook()}
            className="bg-[#fae008] text-slate-950 hover:bg-[#fae008]/90"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Book Job
          </Button>
        </div>
      </div>

      {view === "month" && (
        <MonthView 
          jobs={jobs}
          currentDate={currentDate}
          onJobClick={onSelectJob}
          onQuickBook={handleQuickBook}
        />
      )}
      
      {view === "week" && (
        <WeekView
          jobs={jobs}
          currentDate={currentDate}
          onJobClick={onSelectJob}
          onQuickBook={handleQuickBook}
        />
      )}

      {view === "day" && (
        <DayView
          jobs={jobs}
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