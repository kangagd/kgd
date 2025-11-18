import React from "react";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Clock, Grip } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  scheduled: "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const statusBorderColors = {
  open: "#3b82f6",
  scheduled: "#14b8a6",
  completed: "#22c55e",
  cancelled: "#ef4444",
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
              className={`border-2 border-[hsl(32,15%,88%)] rounded-2xl overflow-hidden ${
                isToday ? 'ring-2 ring-[#fae008]' : ''
              }`}
            >
              <div className="p-4 border-b border-[hsl(32,15%,88%)] bg-[#F7F7F7]">
                <div className="text-sm font-medium text-[hsl(25,8%,55%)]">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-2xl font-bold ${
                  isToday ? 'text-[#111111]' : 'text-[hsl(25,10%,12%)]'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>

              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-3 min-h-[200px] ${
                      snapshot.isDraggingOver ? 'bg-[#FEF8C8]' : 'bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      {dayJobs.length === 0 ? (
                        <p className="text-xs text-[hsl(25,8%,55%)] text-center py-4">No jobs</p>
                      ) : (
                        dayJobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => onJobClick(job)}
                                className={`p-3 rounded-xl bg-white border-2 hover:shadow-md transition-all cursor-pointer ${
                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-[#fae008]' : 'border-[hsl(32,15%,88%)]'
                                }`}
                                style={{
                                  ...provided.draggableProps.style,
                                  borderLeftWidth: '4px',
                                  borderLeftColor: statusBorderColors[job.status] || '#94a3b8'
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <Grip className="w-4 h-4 text-[hsl(25,8%,55%)] mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-[hsl(25,10%,12%)] line-clamp-2 mb-1">
                                      {job.customer_name}
                                    </div>
                                    {job.scheduled_time && (
                                      <div className="flex items-center gap-1 text-xs text-[hsl(25,8%,45%)] mb-2">
                                        <Clock className="w-3 h-3" />
                                        {job.scheduled_time}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {job.job_type_name && (
                                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs font-semibold border-2">
                                          {job.job_type_name}
                                        </Badge>
                                      )}
                                      <Badge className={`${statusColors[job.status]} text-xs font-semibold border-2`}>
                                        {job.status}
                                      </Badge>
                                    </div>
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