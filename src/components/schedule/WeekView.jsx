import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { Clock } from "lucide-react";

const statusColors = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

export default function WeekView({ currentDate, jobs, onJobReschedule, onJobClick, isLoading }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
    
    const sourceDay = weekDays[parseInt(result.source.droppableId)];
    const destDay = weekDays[parseInt(result.destination.droppableId)];
    
    if (!isSameDay(sourceDay, destDay)) {
      onJobReschedule(result.draggableId, destDay);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-16 bg-slate-200 rounded mb-2"></div>
            <div className="h-20 bg-slate-100 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day, dayIndex) => {
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Droppable key={dayIndex} droppableId={String(dayIndex)}>
              {(provided, snapshot) => (
                <Card
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-4 border-none shadow-sm transition-all min-h-[400px] ${
                    isToday ? 'ring-2 ring-orange-500' : ''
                  } ${snapshot.isDraggingOver ? 'bg-orange-50 ring-2 ring-orange-300' : ''}`}
                >
                  <div className="mb-3 pb-2 border-b border-slate-200">
                    <div className="text-sm font-medium text-slate-500">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-orange-600' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {dayJobs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">No jobs scheduled</p>
                    ) : (
                      dayJobs.map((job, index) => (
                        <Draggable key={job.id} draggableId={job.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onJobClick(job)}
                              className={`p-3 rounded-lg bg-white border-l-4 cursor-pointer transition-all ${
                                snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : 'hover:shadow-md'
                              }`}
                              style={{
                                borderLeftColor: statusColors[job.status]?.replace('bg-', '#') || '#64748b',
                                ...provided.draggableProps.style,
                              }}
                            >
                              <div className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1">
                                #{job.job_number} {job.customer_name}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                                  <Clock className="w-3 h-3" />
                                  {job.scheduled_time || 'No time set'}
                                </div>
                                {job.expected_duration && (
                                  <div className="text-xs text-slate-400 ml-2">
                                    {job.expected_duration}h
                                  </div>
                                )}
                              </div>
                              {job.job_type_name && (
                                <Badge variant="outline" className="text-xs">
                                  {job.job_type_name}
                                </Badge>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                </Card>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}