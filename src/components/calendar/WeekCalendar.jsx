import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const colorPalette = [
  "bg-blue-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-red-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-pink-500",
];

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return colorPalette[index % colorPalette.length] || "bg-slate-500";
};

export default function WeekCalendar({ jobs, currentDate, onDateChange, onJobClick, onJobDrop }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const uniqueJobTypes = [...new Set(jobs.filter(job => job).map(job => job.job_type_name).filter(Boolean))].sort();

  const getJobsForDay = (day) => {
    return jobs
      .filter(job => job && job.scheduled_date && isSameDay(new Date(job.scheduled_date), day))
      .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const jobId = result.draggableId;
    const newDate = result.destination.droppableId;
    
    onJobDrop(jobId, newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
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
            onClick={() => onDateChange(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-2">
          {daysInWeek.map(day => {
            const dayJobs = getJobsForDay(day);
            const isToday = isSameDay(day, new Date());
            const dateString = format(day, 'yyyy-MM-dd');

            return (
              <Card
                key={dateString}
                className={`${isToday ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <CardContent className="p-2 md:p-3">
                  <div className={`text-sm font-semibold mb-2 text-center ${
                    isToday ? 'text-blue-600' : 'text-slate-700'
                  }`}>
                    <div>{format(day, 'EEE')}</div>
                    <div className="text-lg">{format(day, 'd')}</div>
                  </div>
                  
                  <Droppable droppableId={dateString}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-1 min-h-[100px] p-1 rounded ${
                          snapshot.isDraggingOver ? 'bg-blue-100' : ''
                        }`}
                      >
                        {dayJobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => onJobClick(job)}
                                className={`text-xs p-2 rounded cursor-pointer ${
                                  getJobTypeColor(job.job_type_name, uniqueJobTypes)
                                } text-white ${
                                  snapshot.isDragging ? 'opacity-50' : 'hover:opacity-80'
                                } transition-opacity`}
                              >
                                <div className="font-medium">
                                  {job.scheduled_time && format(new Date(`2000-01-01T${job.scheduled_time}`), 'h:mm a')}
                                </div>
                                <div className="truncate">{job.customer_name || 'No customer'}</div>
                                <div className="text-xs opacity-80 truncate">{job.job_type_name || 'No type'}</div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DragDropContext>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="font-semibold text-slate-700">Job Types:</span>
        {uniqueJobTypes.map((jobType) => (
          <div key={jobType} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${getJobTypeColor(jobType, uniqueJobTypes)}`} />
            <span className="text-slate-600">{jobType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}