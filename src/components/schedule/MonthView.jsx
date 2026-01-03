import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, parseISO } from "date-fns";

const statusColors = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

export default function MonthView({ currentDate, jobs, onJobReschedule, onJobClick, isLoading }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getJobsForDay = (day) => {
    return jobs.filter(job => {
      try {
        // Check primary scheduled_date
        if (job.scheduled_date && isSameDay(parseISO(job.scheduled_date), day)) {
          return true;
        }
        // Check scheduled_visits array
        if (job.scheduled_visits && Array.isArray(job.scheduled_visits)) {
          return job.scheduled_visits.some(visit => 
            visit.date && isSameDay(parseISO(visit.date), day)
          );
        }
        return false;
      } catch {
        return false;
      }
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const sourceDay = calendarDays[parseInt(result.source.droppableId)];
    const destDay = calendarDays[parseInt(result.destination.droppableId)];
    
    if (!isSameDay(sourceDay, destDay)) {
      onJobReschedule(result.draggableId, destDay);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-slate-600 border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, dayIndex) => {
            const dayJobs = getJobsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <Droppable key={dayIndex} droppableId={String(dayIndex)}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[120px] p-2 border-b border-r border-slate-200 transition-colors ${
                      !isCurrentMonth ? 'bg-slate-50' : ''
                    } ${snapshot.isDraggingOver ? 'bg-orange-50' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-2 ${
                      isToday 
                        ? 'bg-orange-600 text-white w-7 h-7 rounded-full flex items-center justify-center' 
                        : isCurrentMonth 
                          ? 'text-slate-900' 
                          : 'text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </div>

                    <div className="space-y-1">
                      {dayJobs.slice(0, 3).map((job, index) => (
                        <Draggable key={job.id} draggableId={job.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onJobClick(job)}
                              className={`px-2 py-1 rounded text-xs cursor-pointer transition-all ${
                                snapshot.isDragging ? 'shadow-lg scale-110' : 'hover:shadow-md'
                              }`}
                              style={{
                                backgroundColor: statusColors[job.status]?.replace('bg-', '#') + '20' || '#64748b20',
                                borderLeft: `3px solid ${statusColors[job.status]?.replace('bg-', '#') || '#64748b'}`,
                                ...provided.draggableProps.style,
                              }}
                            >
                              <div className="font-medium text-slate-900 truncate">
                                #{job.job_number}
                              </div>
                              <div className="text-slate-600 truncate">
                                {job.customer_name}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {dayJobs.length > 3 && (
                        <div className="text-xs text-slate-500 pl-2">
                          +{dayJobs.length - 3} more
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}