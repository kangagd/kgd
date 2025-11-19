import React from "react";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Clock, Grip } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

export default function WeekCalendar({ currentDate, jobs, onJobDrop, onJobClick, isLoading }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getJobsForDay = (day) => {
    return jobs.filter(job => {
      try {
        return job.scheduled_date && isSameDay(parseISO(job.scheduled_date), day);
      } catch {
        return false;
      }
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const jobId = result.draggableId;
    const destinationDayIndex = parseInt(result.destination.droppableId.split('-')[1]);
    const newDate = addDays(weekStart, destinationDayIndex);

    onJobDrop(jobId, newDate);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day, dayIndex) => {
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card
              key={day.toISOString()}
              className={`border-none shadow-sm ${isToday ? 'ring-2 ring-orange-500' : ''}`}
            >
              <div className="p-4 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-500">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-2xl font-bold ${isToday ? 'text-orange-600' : 'text-slate-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>

              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-3 min-h-[200px] ${
                      snapshot.isDraggingOver ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      {dayJobs.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No jobs</p>
                      ) : (
                        dayJobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => onJobClick(job)}
                                className={`p-2 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all cursor-pointer ${
                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-orange-400' : ''
                                }`}
                                style={{
                                  ...provided.draggableProps.style,
                                  borderLeftWidth: '3px',
                                  borderLeftColor: statusColors[job.status]?.replace('bg-', '#') || '#94a3b8'
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <Grip className="w-3 h-3 text-slate-400 mt-1 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 line-clamp-2">
                                      {job.customer_name}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                      <Clock className="w-3 h-3" />
                                      {job.scheduled_time || 'No time'}
                                    </div>
                                    {job.job_type_name && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        {job.job_type_name}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </Card>
          );
        })}
      </div>
    </DragDropContext>
  );
}