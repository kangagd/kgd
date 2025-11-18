import React from "react";
import { Card } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, parseISO, eachDayOfInterval } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Grip } from "lucide-react";

const statusColors = {
  open: "#3b82f6",
  scheduled: "#14b8a6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

export default function MonthCalendar({ currentDate, jobs, onJobDrop, onJobClick, isLoading }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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
    const newDate = calendarDays[destinationDayIndex];

    onJobDrop(jobId, newDate);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Card className="border-2 border-[hsl(32,15%,88%)] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 bg-[#F7F7F7] border-b-2 border-[hsl(32,15%,88%)]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-[hsl(25,10%,12%)] border-r border-[hsl(32,15%,88%)] last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, dayIndex) => {
            const dayJobs = getJobsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <Droppable key={day.toISOString()} droppableId={`day-${dayIndex}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[120px] p-2 border-r border-b border-[hsl(32,15%,88%)] ${
                      !isCurrentMonth ? 'bg-[#F7F7F7]' : 'bg-white'
                    } ${snapshot.isDraggingOver ? 'bg-[#FEF8C8]' : ''}`}
                  >
                    <div className="mb-2">
                      <div
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                          isToday
                            ? 'bg-[#fae008] text-[#111111]'
                            : !isCurrentMonth
                            ? 'text-[hsl(25,8%,55%)]'
                            : 'text-[hsl(25,10%,12%)]'
                        }`}
                      >
                        {format(day, 'd')}
                      </div>
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
                              className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-[#fae008]' : 'hover:shadow-md'
                              }`}
                              style={{
                                ...provided.draggableProps.style,
                                backgroundColor: statusColors[job.status] || '#94a3b8',
                                color: 'white'
                              }}
                            >
                              <Grip className="w-2 h-2 flex-shrink-0" />
                              <span className="truncate flex-1">{job.customer_name}</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {dayJobs.length > 3 && (
                        <div className="text-xs text-[hsl(25,8%,55%)] text-center py-1 font-medium">
                          +{dayJobs.length - 3} more
                        </div>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </Card>
    </DragDropContext>
  );
}