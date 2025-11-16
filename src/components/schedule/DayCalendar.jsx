import React from "react";
import { Card } from "@/components/ui/card";
import { format, isSameDay, parseISO } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Clock, Grip, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

export default function DayCalendar({ currentDate, jobs, onJobDrop, onJobClick, isLoading }) {
  const getJobsForDay = () => {
    return jobs.filter(job => {
      try {
        return job.scheduled_date && isSameDay(parseISO(job.scheduled_date), currentDate);
      } catch {
        return false;
      }
    }).sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  };

  const dayJobs = getJobsForDay();
  const isToday = isSameDay(currentDate, new Date());

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    // For day view, we don't change dates, just reorder
    // Could implement time-based reordering in the future
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Card className={`border-none shadow-sm ${isToday ? 'ring-2 ring-orange-500' : ''}`}>
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="text-sm font-medium text-slate-500">
            {format(currentDate, 'EEEE')}
          </div>
          <div className={`text-3xl font-bold mt-1 ${isToday ? 'text-orange-600' : 'text-slate-900'}`}>
            {format(currentDate, 'MMMM d, yyyy')}
          </div>
          <div className="text-sm text-slate-600 mt-2">
            {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'} scheduled
          </div>
        </div>

        <Droppable droppableId="day-view">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-6 min-h-[400px] ${
                snapshot.isDraggingOver ? 'bg-orange-50' : ''
              }`}
            >
              {dayJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg">No jobs scheduled for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dayJobs.map((job, index) => (
                    <Draggable key={job.id} draggableId={job.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => onJobClick(job)}
                          className={`p-4 rounded-lg bg-white border-2 border-slate-200 hover:shadow-lg transition-all cursor-pointer ${
                            snapshot.isDragging ? 'shadow-xl ring-2 ring-orange-400' : ''
                          }`}
                          style={{
                            ...provided.draggableProps.style,
                            borderLeftWidth: '4px',
                            borderLeftColor: statusColors[job.status]?.replace('bg-', '#') || '#94a3b8'
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <Grip className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-slate-900">
                                    {job.customer_name}
                                  </h3>
                                  <p className="text-sm text-slate-500">Job #{job.job_number}</p>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700">
                                  <Clock className="w-4 h-4 text-orange-600" />
                                  <span className="text-sm font-medium">
                                    {job.scheduled_time || 'No time'}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-start gap-2 text-slate-600">
                                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm">{job.address}</span>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-3">
                                  {job.job_type_name && (
                                    <Badge variant="outline" className="text-slate-700">
                                      {job.job_type_name}
                                    </Badge>
                                  )}
                                  {job.assigned_to_name && (
                                    Array.isArray(job.assigned_to_name) ? (
                                      job.assigned_to_name.map((name, idx) => (
                                        <Badge key={idx} variant="outline" className="text-slate-700">
                                          <User className="w-3 h-3 mr-1" />
                                          {name}
                                        </Badge>
                                      ))
                                    ) : (
                                      <Badge variant="outline" className="text-slate-700">
                                        <User className="w-3 h-3 mr-1" />
                                        {job.assigned_to_name}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </Card>
    </DragDropContext>
  );
}